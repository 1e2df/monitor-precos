// Banco SQLite (nativo do Node 22+): lojas, catálogo, histórico de preços, favoritos, alertas e cupons.
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { analisar, estatisticas } = require('./analisar');

const DIA = 86400000;
const db = new DatabaseSync(process.env.MONITOR_DB || path.join(__dirname, 'catalogo.db'));
db.exec(`
PRAGMA busy_timeout = 10000;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
CREATE TABLE IF NOT EXISTS lojas (
  id INTEGER PRIMARY KEY, nome TEXT NOT NULL, dominio TEXT NOT NULL, plataforma TEXT NOT NULL,
  urls TEXT, ativo INTEGER DEFAULT 1, criado_em INTEGER, coletado_em INTEGER DEFAULT 0,
  erro TEXT, coletando INTEGER DEFAULT 0, produtos_ultima INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS produtos (
  id TEXT PRIMARY KEY, loja_id INTEGER NOT NULL, nome TEXT, busca TEXT, marca TEXT, categoria TEXT,
  url TEXT, imagem TEXT, preco REAL, preco_de REAL, desconto REAL DEFAULT 0, queda REAL DEFAULT 0,
  mediana REAL, minimo REAL, maximo REAL, n_pontos INTEGER DEFAULT 0, preco_anterior REAL,
  selo TEXT, selo_nivel INTEGER DEFAULT 0, selo_motivo TEXT, selo_em INTEGER,
  criado_em INTEGER, visto_em INTEGER, mudou_em INTEGER
);
CREATE INDEX IF NOT EXISTS ix_prod_loja ON produtos(loja_id);
CREATE INDEX IF NOT EXISTS ix_prod_selo ON produtos(selo_nivel DESC, desconto DESC);
CREATE INDEX IF NOT EXISTS ix_prod_visto ON produtos(visto_em);
CREATE TABLE IF NOT EXISTS historico (produto_id TEXT NOT NULL, t INTEGER NOT NULL, preco REAL NOT NULL, preco_de REAL);
CREATE INDEX IF NOT EXISTS ix_hist ON historico(produto_id, t);
CREATE TABLE IF NOT EXISTS favoritos (produto_id TEXT PRIMARY KEY, criado_em INTEGER, preco_inicial REAL, preco_alvo REAL);
CREATE TABLE IF NOT EXISTS interesses (id INTEGER PRIMARY KEY, termo TEXT NOT NULL, preco_max REAL, criado_em INTEGER);
CREATE TABLE IF NOT EXISTS alertas (
  id INTEGER PRIMARY KEY, t INTEGER, tipo TEXT, nivel INTEGER, produto_id TEXT, motivo TEXT,
  preco REAL, preco_de REAL, favorito INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_alertas_t ON alertas(t DESC);
CREATE TABLE IF NOT EXISTS cupons (
  id TEXT PRIMARY KEY, loja_id INTEGER NOT NULL, codigo TEXT, titulo TEXT, desconto TEXT, validade TEXT, url TEXT, visto_em INTEGER
);
CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT);
UPDATE lojas SET coletando = 0;
`);
// colunas adicionadas depois da primeira versão
function garantirColunas(tabela, defs) {
  const tem = db.prepare(`PRAGMA table_info(${tabela})`).all().map(c => c.name);
  for (const [c, tipo] of Object.entries(defs)) if (!tem.includes(c)) db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${c} ${tipo}`);
}
// foco: 'tecnologia' = loja especializada (produto sem classificação clara entra); 'misto' = vende de tudo (só entra o que é claramente tecnologia)
garantirColunas('lojas', { inflacao: 'REAL DEFAULT 0', cupons_em: 'INTEGER DEFAULT 0', barata: 'INTEGER DEFAULT 0', foco: "TEXT DEFAULT 'misto'" });
garantirColunas('produtos', { ean: 'TEXT', preco_pix: 'REAL', estoque: 'INTEGER', disponivel: 'INTEGER DEFAULT 1', conferido_em: 'INTEGER', comparado_em: 'INTEGER' });
db.exec('CREATE INDEX IF NOT EXISTS ix_prod_ean ON produtos(ean) WHERE ean IS NOT NULL');

const normalizar = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const q = sql => db.prepare(sql);
const recente = () => Date.now() - 3 * DIA;

const meta = {
  ler: k => q('SELECT valor FROM meta WHERE chave = ?').get(k)?.valor ?? null,
  gravar: (k, v) => q('INSERT INTO meta (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').run(k, String(v)),
};

// ---------- lojas ----------
const lojaDe = r => r && { ...r, urls: r.urls ? JSON.parse(r.urls) : [], ativo: !!r.ativo, coletando: !!r.coletando };
const lojas = {
  todas: () => q(`SELECT l.*, (SELECT COUNT(*) FROM produtos p WHERE p.loja_id = l.id) total,
    (SELECT COUNT(*) FROM cupons c WHERE c.loja_id = l.id) n_cupons FROM lojas l ORDER BY l.nome`).all().map(lojaDe),
  uma: id => lojaDe(q('SELECT * FROM lojas WHERE id = ?').get(id)),
  porDominio: d => lojaDe(q('SELECT * FROM lojas WHERE dominio = ?').get(d)),
  criar: l => Number(q('INSERT INTO lojas (nome, dominio, plataforma, urls, criado_em) VALUES (?, ?, ?, ?, ?)')
    .run(l.nome, l.dominio, l.plataforma, JSON.stringify(l.urls || []), Date.now()).lastInsertRowid),
  atualizar: (id, campos) => {
    const ks = Object.keys(campos);
    if (!ks.length) return;
    q(`UPDATE lojas SET ${ks.map(k => k + ' = ?').join(', ')} WHERE id = ?`)
      .run(...ks.map(k => (k === 'urls' ? JSON.stringify(campos[k]) : typeof campos[k] === 'boolean' ? +campos[k] : campos[k])), id);
  },
  apagar: id => {
    q('DELETE FROM historico WHERE produto_id IN (SELECT id FROM produtos WHERE loja_id = ?)').run(id);
    q('DELETE FROM favoritos WHERE produto_id IN (SELECT id FROM produtos WHERE loja_id = ?)').run(id);
    q('DELETE FROM alertas WHERE produto_id IN (SELECT id FROM produtos WHERE loja_id = ?)').run(id);
    q('DELETE FROM cupons WHERE loja_id = ?').run(id);
    q('DELETE FROM produtos WHERE loja_id = ?').run(id);
    q('DELETE FROM lojas WHERE id = ?').run(id);
  },
};

// ---------- cupons ----------
const cupons = {
  substituir: (lojaId, lista) => {
    db.exec('BEGIN');
    try {
      q('DELETE FROM cupons WHERE loja_id = ?').run(lojaId);
      const st = q('INSERT OR REPLACE INTO cupons (id, loja_id, codigo, titulo, desconto, validade, url, visto_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      for (const c of lista) st.run(c.id, lojaId, c.codigo, c.titulo, c.desconto, c.validade, c.url, Date.now());
      q('UPDATE lojas SET cupons_em = ? WHERE id = ?').run(Date.now(), lojaId);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  },
  daLoja: lojaId => q('SELECT * FROM cupons WHERE loja_id = ? ORDER BY validade IS NULL, validade').all(lojaId),
};

// ---------- interesses (buscas seguidas) ----------
const interesses = {
  todos: () => q('SELECT * FROM interesses ORDER BY termo').all(),
  criar: (termo, precoMax) => Number(q('INSERT INTO interesses (termo, preco_max, criado_em) VALUES (?, ?, ?)').run(termo, precoMax || null, Date.now()).lastInsertRowid),
  apagar: id => q('DELETE FROM interesses WHERE id = ?').run(id),
};
function casaInteresse(busca, preco, lista) {
  return lista.find(i => normalizar(i.termo).split(' ').every(w => busca.includes(w)) && (!i.preco_max || preco <= i.preco_max));
}

// ---------- registrar um preço coletado ----------
const stProduto = q('SELECT * FROM produtos WHERE id = ?');
const stPontos = q('SELECT t, preco p FROM (SELECT t, preco FROM historico WHERE produto_id = ? ORDER BY t DESC LIMIT 400) ORDER BY t');
const stFav = q('SELECT * FROM favoritos WHERE produto_id = ?');
const stHist = q('INSERT INTO historico (produto_id, t, preco, preco_de) VALUES (?, ?, ?, ?)');
const stAlerta = q('INSERT INTO alertas (t, tipo, nivel, produto_id, motivo, preco, preco_de, favorito) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
// menor preço do mesmo produto (EAN) em cada uma das outras lojas
const stOutras = q(`SELECT MIN(preco) preco FROM produtos WHERE ean = ? AND loja_id != ? AND visto_em >= ? AND disponivel = 1 GROUP BY loja_id`);
const stUpsert = q(`INSERT INTO produtos (id, loja_id, nome, busca, marca, categoria, url, imagem, preco, preco_de, desconto, queda,
  mediana, minimo, maximo, n_pontos, preco_anterior, selo, selo_nivel, selo_motivo, selo_em, criado_em, visto_em, mudou_em,
  ean, preco_pix, estoque, disponivel, conferido_em)
  VALUES (:id, :loja_id, :nome, :busca, :marca, :categoria, :url, :imagem, :preco, :preco_de, :desconto, :queda,
  :mediana, :minimo, :maximo, :n_pontos, :preco_anterior, :selo, :selo_nivel, :selo_motivo, :selo_em, :criado_em, :visto_em, :mudou_em,
  :ean, :preco_pix, :estoque, 1, :conferido_em)
  ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, busca = excluded.busca, marca = excluded.marca, categoria = excluded.categoria,
  url = excluded.url, imagem = COALESCE(excluded.imagem, imagem), preco = excluded.preco, preco_de = excluded.preco_de,
  desconto = excluded.desconto, queda = excluded.queda, mediana = excluded.mediana, minimo = excluded.minimo, maximo = excluded.maximo,
  n_pontos = excluded.n_pontos, preco_anterior = excluded.preco_anterior, selo = excluded.selo, selo_nivel = excluded.selo_nivel,
  selo_motivo = excluded.selo_motivo, selo_em = excluded.selo_em, visto_em = excluded.visto_em, mudou_em = excluded.mudou_em,
  ean = COALESCE(excluded.ean, ean), preco_pix = excluded.preco_pix, estoque = excluded.estoque, disponivel = 1,
  conferido_em = COALESCE(excluded.conferido_em, conferido_em)`);

// fração de produtos com "de/por" acima do limite de bug a partir da qual o "de" da loja deixa de ser confiável
const LIMITE_INFLACAO = 0.05;

// recalcula a inflação do "de" da loja; se passou do limite, rebaixa os "bugs" que só vinham do "de/por"
function calibrarLoja(loja, lim, desde) {
  const r = q('SELECT COUNT(*) n, SUM(desconto >= ?) altos FROM produtos WHERE loja_id = ? AND visto_em >= ?').get(lim.bugDesconto, loja.id, desde);
  if (!r.n) return;
  const inflacao = r.altos / r.n;
  q('UPDATE lojas SET inflacao = ? WHERE id = ?').run(inflacao, loja.id);
  calibrarEntreLojas(loja, lim, desde);
  if (inflacao <= LIMITE_INFLACAO) return;
  const where = `loja_id = ? AND selo = 'bug' AND selo_nivel = 2 AND queda < ? AND desconto >= ? AND selo_motivo LIKE '%preço "de"%'`;
  q(`DELETE FROM alertas WHERE tipo = 'bug' AND nivel = 2 AND t >= ? AND produto_id IN (SELECT id FROM produtos WHERE ${where})`).run(desde, loja.id, lim.bugQueda, lim.bugDesconto);
  q(`UPDATE produtos SET selo = 'desconto', selo_nivel = 1,
      selo_motivo = CAST(ROUND(desconto * 100) AS INTEGER) || '% abaixo do preço "de" (esta loja costuma inflar o "de")' WHERE ${where}`).run(loja.id, lim.bugQueda, lim.bugDesconto);
}

// loja com muitos produtos "50% mais barato que nas outras" é loja de preço baixo (genéricos, atacarejo), não bug
const BUG_LOJAS = `selo = 'bug' AND selo_motivo LIKE '%mais barato que n%' AND queda < ?`;
function calibrarEntreLojas(loja, lim, desde) {
  const r = q(`SELECT COUNT(*) n, SUM(${BUG_LOJAS}) b FROM produtos WHERE loja_id = ? AND visto_em >= ? AND ean IS NOT NULL`).get(lim.bugQueda, loja.id, desde);
  const barata = r.b >= 4 && r.b / Math.max(r.n, 1) > 0.005;
  q('UPDATE lojas SET barata = ? WHERE id = ?').run(+barata, loja.id);
  if (!barata) return;
  q(`DELETE FROM alertas WHERE tipo = 'bug' AND t >= ? AND produto_id IN (SELECT id FROM produtos WHERE loja_id = ? AND ${BUG_LOJAS})`).run(desde, loja.id, lim.bugQueda);
  q(`UPDATE produtos SET selo = 'desconto', selo_nivel = 1,
      selo_motivo = selo_motivo || '; esta loja costuma ser bem mais barata nestes produtos' WHERE loja_id = ? AND ${BUG_LOJAS}`).run(loja.id, lim.bugQueda);
}

// devolve os alertas novos (para notificar). conferido: leitura feita pela revisão rápida de bugs
function registrar(loja, p, lim, listaInteresses, { agora = Date.now(), conferido = false } = {}) {
  if (!(p.preco > 0) || !p.nome) return [];
  const id = `${loja.id}:${p.chave}`;
  const ex = stProduto.get(id);
  const pontos = stPontos.all(id);
  const fav = stFav.get(id);
  const ean = p.ean || ex?.ean || null;
  const outras = ean ? stOutras.all(ean, loja.id, recente()).map(r => r.preco) : [];
  // remédio (genérico principalmente) tem preço muito diferente entre farmácias: isso é oferta, não bug
  const precoVariavel = !!loja.barata || /medicament|gen[eé]ric/i.test(`${p.categoria || ''} ${p.nome}`);
  const { alertas } = analisar(p, pontos, lim, fav?.preco_alvo, loja.inflacao > LIMITE_INFLACAO, outras, precoVariavel);
  const mudou = !ex || Math.abs(ex.preco - p.preco) >= 0.005;
  const ult = pontos[pontos.length - 1];
  if (mudou || !ult || agora - ult.t > DIA) { stHist.run(id, agora, p.preco, p.precoDe || null); pontos.push({ t: agora, p: p.preco }); }
  const st = estatisticas(pontos);
  const selo = alertas[0] || null;
  const busca = normalizar(`${p.nome} ${p.marca || ''} ${p.categoria || ''} ${loja.nome}`);
  stUpsert.run({
    id, loja_id: loja.id, nome: p.nome.slice(0, 300), busca, marca: p.marca || null, categoria: p.categoria || null,
    url: p.url || null, imagem: p.imagem || null, preco: p.preco, preco_de: p.precoDe || null,
    desconto: p.precoDe ? 1 - p.preco / p.precoDe : 0,
    queda: st.n >= lim.pontosMinimosHistorico && st.mediana ? Math.max(0, 1 - p.preco / st.mediana) : 0,
    mediana: st.mediana, minimo: st.minimo, maximo: st.maximo, n_pontos: st.n,
    preco_anterior: mudou && ex ? ex.preco : ex?.preco_anterior ?? null,
    selo: selo?.tipo || null, selo_nivel: selo?.nivel || 0, selo_motivo: selo?.motivo || null,
    selo_em: selo ? (ex?.selo === selo.tipo && ex.selo_em ? ex.selo_em : agora) : null,
    criado_em: ex?.criado_em || agora, visto_em: agora, mudou_em: mudou ? agora : ex.mudou_em,
    ean, preco_pix: p.precoPix || null, estoque: p.estoque ?? null, conferido_em: conferido ? agora : null,
  });
  // só vira alerta o que é novidade: preço mudou, produto novo ou o selo subiu de nível
  const subiu = ex && selo && (selo.nivel > (ex.selo_nivel || 0) || (selo.tipo === 'bug' && ex.selo !== 'bug'));
  if (!mudou && !subiu) return [];
  const interesse = casaInteresse(busca, p.preco, listaInteresses);
  const novos = [];
  for (const a of alertas) {
    const relevante = a.nivel >= 2 || fav || interesse || (ex && ['queda', 'minimo'].includes(a.tipo));
    if (!relevante || (!mudou && a !== selo)) continue;
    stAlerta.run(agora, a.tipo, a.nivel, id, a.motivo, p.preco, p.precoDe || null, fav ? 1 : 0);
    novos.push({ ...a, produtoId: id, nome: p.nome, url: p.url, imagem: p.imagem, preco: p.preco, precoDe: p.precoDe, loja: loja.nome,
      favorito: !!fav, interesse: interesse?.termo || null });
  }
  return novos;
}

// a revisão rápida não achou mais o produto à venda
function marcarIndisponivel(id) {
  q('UPDATE produtos SET disponivel = 0, conferido_em = ? WHERE id = ?').run(Date.now(), id);
}

// bugs que precisam ser conferidos de novo (os conferidos há mais tempo primeiro)
const paraRevisar = limite => q(`SELECT * FROM produtos WHERE selo = 'bug' AND selo_nivel >= 2 AND disponivel = 1 AND visto_em >= ?
  ORDER BY COALESCE(conferido_em, 0) LIMIT ?`).all(Date.now() - 2 * DIA, limite);
// suspeitos com EAN que ainda não foram comparados com as outras lojas
const paraComparar = limite => q(`SELECT * FROM produtos WHERE ean IS NOT NULL AND comparado_em IS NULL AND selo_nivel >= 2 AND disponivel = 1
  AND visto_em >= ? ORDER BY selo_em DESC LIMIT ?`).all(Date.now() - DIA, limite);
const seloAtual = id => q('SELECT selo, selo_nivel FROM produtos WHERE id = ?').get(id);
const marcarComparado = id => q('UPDATE produtos SET comparado_em = ? WHERE id = ?').run(Date.now(), id);

// ---------- consultas do site ----------
const campos = () => {
  const r = recente();
  return `p.*, l.nome loja, l.dominio, f.produto_id IS NOT NULL favorito, f.preco_alvo, f.preco_inicial,
  CASE WHEN p.ean IS NULL THEN 1 ELSE (SELECT COUNT(DISTINCT o.loja_id) FROM produtos o WHERE o.ean = p.ean AND o.visto_em >= ${r} AND o.disponivel = 1) END n_lojas,
  CASE WHEN p.ean IS NULL THEN NULL ELSE (SELECT MIN(o.preco) FROM produtos o WHERE o.ean = p.ean AND o.loja_id != p.loja_id AND o.visto_em >= ${r} AND o.disponivel = 1) END menor_outras,
  (SELECT COUNT(*) FROM cupons c WHERE c.loja_id = p.loja_id) n_cupons`;
};
const DE = `FROM produtos p JOIN lojas l ON l.id = p.loja_id LEFT JOIN favoritos f ON f.produto_id = p.id`;
// quanto vale a oferta: queda real no histórico pesa mais; "de/por" de loja que infla o "de" pesa pouco
const PONTOS = `(CASE WHEN l.inflacao > ${LIMITE_INFLACAO} THEN p.desconto * 0.35 ELSE p.desconto END + p.queda * 1.5)`;
const ORDENS = {
  oferta: `p.selo_nivel DESC, ${PONTOS} DESC`,
  desconto: `${PONTOS} DESC`,
  queda: 'p.queda DESC, p.mudou_em DESC',
  menor: 'p.preco ASC',
  maior: 'p.preco DESC',
  novos: 'p.criado_em DESC',
  mudou: 'p.mudou_em DESC',
  favoritado: 'f.criado_em DESC',
  bug: 'p.selo_nivel DESC, p.selo_em DESC',
};

function buscar(f = {}) {
  const onde = [], args = [];
  const r = recente();
  const palavras = normalizar(f.q).split(' ').filter(Boolean);
  for (const w of palavras) { onde.push('p.busca LIKE ?'); args.push(`%${w}%`); }
  if (f.loja) { onde.push('p.loja_id = ?'); args.push(+f.loja); }
  if (f.categoria) { onde.push('p.categoria = ?'); args.push(f.categoria); }
  if (f.selo === 'bug') onde.push(`p.selo = 'bug' AND p.selo_nivel >= ${+f.nivel || 2} AND p.disponivel = 1`);
  else if (f.selo === 'ofertas') onde.push(`p.selo IN ('desconto','queda','minimo','alvo')`);
  else if (f.selo) { onde.push('p.selo = ?'); args.push(f.selo); }
  if (f.fav) onde.push('f.produto_id IS NOT NULL');
  if (f.min) { onde.push('p.preco >= ?'); args.push(+f.min); }
  if (f.max) { onde.push('p.preco <= ?'); args.push(+f.max); }
  if (f.off) { onde.push('MAX(p.desconto, p.queda) >= ?'); args.push(+f.off / 100); }
  if (f.mudou) onde.push('p.preco_anterior IS NOT NULL AND p.preco < p.preco_anterior');
  if (f.comparar) onde.push(`p.ean IS NOT NULL AND (SELECT COUNT(DISTINCT o.loja_id) FROM produtos o WHERE o.ean = p.ean AND o.visto_em >= ${r}) >= 2`);
  // um cartão por produto: fica só a loja mais barata entre as que vendem o mesmo EAN
  if (f.agrupar === '1' && !f.loja) onde.push(`(p.ean IS NULL OR p.id = (SELECT o.id FROM produtos o WHERE o.ean = p.ean AND o.visto_em >= ${r} AND o.disponivel = 1 ORDER BY o.preco, o.id LIMIT 1))`);
  if (!f.fav && !f.todos) { onde.push('p.visto_em >= ?'); args.push(r); }
  if (!f.fav) onde.push('l.ativo = 1');
  const where = onde.length ? 'WHERE ' + onde.join(' AND ') : '';
  const limite = Math.min(+f.limite || 48, 200), pagina = Math.max(+f.pagina || 0, 0);
  const itens = q(`SELECT ${campos()} ${DE} ${where} ORDER BY ${ORDENS[f.ord] || ORDENS.oferta}, p.id LIMIT ${limite} OFFSET ${pagina * limite}`).all(...args);
  const total = q(`SELECT COUNT(*) n ${DE} ${where}`).get(...args).n;
  return { itens, total, pagina, limite };
}

const produto = id => {
  const p = q(`SELECT ${campos()} ${DE} WHERE p.id = ?`).get(id);
  if (!p) return null;
  p.historico = q('SELECT t, preco, preco_de FROM historico WHERE produto_id = ? ORDER BY t').all(id);
  p.semelhantes = p.categoria ? q(`SELECT ${campos()} ${DE} WHERE p.categoria = ? AND p.id != ? AND p.visto_em >= ? ORDER BY ${PONTOS} DESC LIMIT 8`)
    .all(p.categoria, id, recente()) : [];
  p.ofertas = p.ean ? q(`SELECT ${campos()} ${DE} WHERE p.ean = ? AND p.visto_em >= ? ORDER BY p.disponivel DESC, p.preco`).all(p.ean, recente()) : [];
  p.cupons = cupons.daLoja(p.loja_id);
  return p;
};

const categorias = loja => q(`SELECT p.categoria nome, COUNT(*) n FROM produtos p JOIN lojas l ON l.id = p.loja_id WHERE p.categoria IS NOT NULL AND l.ativo = 1
  ${loja ? 'AND p.loja_id = ' + +loja : ''} AND p.visto_em >= ? GROUP BY p.categoria ORDER BY n DESC LIMIT 60`).all(recente());

const favoritos = {
  adicionar: (id, alvo) => {
    const p = stProduto.get(id);
    if (!p) throw new Error('produto não encontrado');
    q(`INSERT INTO favoritos (produto_id, criado_em, preco_inicial, preco_alvo) VALUES (?, ?, ?, ?)
       ON CONFLICT(produto_id) DO UPDATE SET preco_alvo = excluded.preco_alvo`).run(id, Date.now(), p.preco, alvo || null);
  },
  remover: id => q('DELETE FROM favoritos WHERE produto_id = ?').run(id),
};

function resumo() {
  const r = recente();
  const n = sql => q(sql).get(r).n;
  const top = (where, ord, lim = 12) => q(`SELECT ${campos()} ${DE} WHERE p.visto_em >= ? AND l.ativo = 1 AND ${where} ORDER BY ${ord} LIMIT ${lim}`).all(r);
  return {
    produtos: n('SELECT COUNT(*) n FROM produtos p JOIN lojas l ON l.id = p.loja_id WHERE p.visto_em >= ? AND l.ativo = 1'),
    lojas: q('SELECT COUNT(*) n FROM lojas WHERE ativo = 1').get().n,
    bugs: n(`SELECT COUNT(*) n FROM produtos p JOIN lojas l ON l.id = p.loja_id WHERE p.visto_em >= ? AND l.ativo = 1 AND selo = 'bug' AND selo_nivel >= 2 AND disponivel = 1`),
    ofertas: n(`SELECT COUNT(*) n FROM produtos p JOIN lojas l ON l.id = p.loja_id WHERE p.visto_em >= ? AND l.ativo = 1 AND selo IN ('desconto','queda','minimo','alvo')`),
    comparaveis: n(`SELECT COUNT(DISTINCT ean) n FROM produtos p WHERE visto_em >= ? AND ean IS NOT NULL AND EXISTS (SELECT 1 FROM produtos o WHERE o.ean = p.ean AND o.loja_id != p.loja_id)`),
    cupons: q('SELECT COUNT(*) n FROM cupons').get().n,
    favoritos: q('SELECT COUNT(*) n FROM favoritos').get().n,
    bugsLista: top(`p.selo = 'bug' AND p.selo_nivel >= 2 AND p.disponivel = 1`, ORDENS.bug),
    quedas: top('p.preco_anterior IS NOT NULL AND p.preco < p.preco_anterior * 0.9', 'p.mudou_em DESC'),
    descontos: top(`p.selo IN ('desconto','queda','minimo')`, `${PONTOS} DESC`),
    entreLojas: top(`p.ean IS NOT NULL AND p.preco < 0.8 * (SELECT MIN(o.preco) FROM produtos o WHERE o.ean = p.ean AND o.loja_id != p.loja_id AND o.visto_em >= ${r} AND o.disponivel = 1)`,
      `p.preco / (SELECT MIN(o.preco) FROM produtos o WHERE o.ean = p.ean AND o.loja_id != p.loja_id AND o.visto_em >= ${r}) ASC`),
    favoritosEmQueda: q(`SELECT ${campos()} ${DE} WHERE f.produto_id IS NOT NULL ORDER BY (p.preco < f.preco_inicial) DESC, p.mudou_em DESC LIMIT 12`).all(),
  };
}

// conteúdo do resumo diário: o que aconteceu nas últimas 24h
function resumoDiario() {
  const desde = Date.now() - DIA;
  const lista = (where, ord, lim = 5, ...args) => q(`SELECT ${campos()} ${DE} WHERE l.ativo = 1 AND ${where} ORDER BY ${ord} LIMIT ${lim}`).all(...args);
  return {
    bugs: lista(`p.selo = 'bug' AND p.selo_nivel >= 2 AND p.disponivel = 1 AND p.visto_em >= ?`, ORDENS.bug, 5, desde),
    quedas: lista(`p.mudou_em >= ? AND p.preco_anterior IS NOT NULL AND p.preco < p.preco_anterior * 0.85`, 'p.preco / p.preco_anterior', 5, desde),
    entreLojas: resumo().entreLojas.slice(0, 5),
    favoritos: lista(`f.produto_id IS NOT NULL AND (p.preco < f.preco_inicial * 0.98 OR (p.mudou_em >= ? AND p.preco < p.preco_anterior))`, 'p.preco / f.preco_inicial', 10, desde),
    interesses: interesses.todos().map(i => ({ termo: i.termo, melhor: buscar({ q: i.termo, max: i.preco_max || '', ord: 'oferta', limite: 1, agrupar: '1' }).itens[0] || null })),
  };
}

// apaga o que não é tecnologia; pausadas: também o que é de loja pausada (ao ligar o modo "só tecnologia")
function purgar(manter, { pausadas = false } = {}) {
  const ps = q('SELECT p.id, p.nome, p.categoria, l.foco, l.ativo FROM produtos p JOIN lojas l ON l.id = p.loja_id').all();
  const fora = ps.filter(p => (pausadas && !p.ativo) || !manter(p, p.foco)).map(p => p.id);
  db.exec('BEGIN');
  try {
    const sts = ['historico', 'alertas', 'favoritos'].map(t => q(`DELETE FROM ${t} WHERE produto_id = ?`));
    const sp = q('DELETE FROM produtos WHERE id = ?');
    for (const id of fora) { for (const st of sts) st.run(id); sp.run(id); }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { apagados: fora.length, restantes: ps.length - fora.length };
}

const alertas = (limite = 100, soFav = false) => q(`SELECT a.*, p.nome, p.url, p.imagem, l.nome loja FROM alertas a
  JOIN produtos p ON p.id = a.produto_id JOIN lojas l ON l.id = p.loja_id WHERE l.ativo = 1 ${soFav ? 'AND a.favorito = 1' : ''} ORDER BY a.t DESC LIMIT ?`).all(limite);

module.exports = {
  db, meta, lojas, cupons, interesses, registrar, seloAtual, calibrarLoja, marcarIndisponivel, paraRevisar, paraComparar, marcarComparado,
  buscar, produto, categorias, favoritos, resumo, resumoDiario, alertas, normalizar, purgar,
};
