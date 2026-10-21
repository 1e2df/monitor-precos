// Monitor de preços: junta o catálogo de várias lojas, guarda o histórico de cada produto e
// destaca descontos de verdade e prováveis bugs de preço. Site em http://localhost:3100
// Requer só Node 22+ (usa o SQLite embutido). Edge/Chrome é usado para sites que dependem de JavaScript.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { COLETORES, detectar, nomeDaLoja, lerProduto, buscarEan, cuponsDaLoja } = require('./conectores');
const { extrair } = require('./extrair');
const banco = require('./db');
const { notificar, enviarTexto } = require('./notificar');
const { ehTecnologia, TERMOS } = require('./tecnologia');
const celular = require('./celular');

const ARQ_CONFIG = path.join(__dirname, 'config.json');

// ---------- config ----------
const PADRAO = {
  porta: 3100,
  // app no celular: túnel Cloudflare + endereço publicado num gist secreto (TUNNEL=0 desliga)
  celular: { ativo: true, app: 'https://1e2df.github.io/monitor-precos/site/' },
  apenasTecnologia: true,  // só produtos de tecnologia (lojas mistas são lidas por termos como "notebook", "smart tv"...)
  intervaloMin: 60,        // cada loja é relida a cada X minutos
  paginasPorLoja: 6,       // páginas de 50 produtos ordenadas por desconto (VTEX)
  lojasEmParalelo: 6,
  esperaMs: 1200,          // pausa entre requisições na mesma loja
  revisaoBugsMin: 5,       // bugs são conferidos de novo a cada X minutos (eles somem rápido)
  comparacoesPorRevisao: 8, // suspeitos com EAN procurados nas outras lojas a cada revisão
  cuponsHoras: 6,
  resumoDiario: { ativo: true, hora: 8 },
  limites: {
    descontoMinimo: 0.30,  // "de/por" com pelo menos 30% off
    quedaMinima: 0.15,     // 15% abaixo do preço normal (mediana dos últimos 30 dias)
    bugDesconto: 0.70,     // 70%+ off no "de/por" = suspeito
    bugQueda: 0.55,        // 55%+ abaixo do preço normal = provável bug
    bugEntreLojas: 0.50,   // 50%+ mais barato que o mesmo produto (EAN) nas outras lojas = provável bug
    descontoEntreLojas: 0.20,
    pontosMinimosHistorico: 3,
  },
  notificar: { nivelMinimo: 1, windows: true, telegram: { token: '', chatId: '' }, discordWebhook: '', ntfyTopico: '' },
};
function mesclar(a, b) {
  const o = { ...a };
  for (const k in b) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] ? mesclar(a[k], b[k]) : b[k];
  return o;
}
if (!fs.existsSync(ARQ_CONFIG)) fs.writeFileSync(ARQ_CONFIG, JSON.stringify(PADRAO, null, 2));
const cfg = mesclar(PADRAO, JSON.parse(fs.readFileSync(ARQ_CONFIG, 'utf8')));

// ---------- lojas iniciais (todas testadas com catálogo público) ----------
const KABUM = ['hardware/placa-de-video-vga', 'hardware/processadores', 'hardware/ssd-2-5', 'hardware/memoria-ram',
  'computadores/notebooks', 'celular-smartphone/smartphones', 'perifericos', 'tv']
  .map(c => `https://www.kabum.com.br/${c}?page_number=1&page_size=100`);
const SEMENTES = [
  ['Carrefour', 'www.carrefour.com.br', 'vtex'], ['Americanas', 'www.americanas.com.br', 'vtex'],
  ['Ri Happy', 'www.rihappy.com.br', 'vtex'], ['Cobasi', 'www.cobasi.com.br', 'vtex'], ['C&A', 'www.cea.com.br', 'vtex'],
  ['Electrolux', 'loja.electrolux.com.br', 'vtex'], ['Mondial', 'www.mondial.com.br', 'vtex'], ['Multilaser', 'www.multilaser.com.br', 'vtex'],
  ['Pague Menos', 'www.paguemenos.com.br', 'vtex'], ['Drogaria São Paulo', 'www.drogariasaopaulo.com.br', 'vtex'],
  ['Polishop', 'www.polishop.com.br', 'vtex'], ['Consul', 'www.consul.com.br', 'vtex'], ['Brastemp', 'www.brastemp.com.br', 'vtex'],
  ['Motorola', 'www.motorola.com.br', 'vtex'], ['Amoedo', 'www.amoedo.com.br', 'vtex'], ['Lojas MM', 'www.lojasmm.com', 'vtex'],
  ['Época Cosméticos', 'www.epocacosmeticos.com.br', 'vtex-legado'],
  ['Philco', 'www.philco.com.br', 'vtex-legado'], ['Havaianas', 'www.havaianas.com.br', 'shopify'],
  ['KaBuM!', 'www.kabum.com.br', 'pagina', KABUM], ['Promobit', 'www.promobit.com.br', 'pagina', ['https://www.promobit.com.br/']],
  ['Pichau', 'www.pichau.com.br', 'pagina', ['https://www.pichau.com.br/hardware/placa-de-video']],
];
// lojas adicionadas na versão 2 (também testadas)
const SEMENTES_2 = [
  ['Casa&Video', 'www.casaevideo.com.br'], ['Sam\'s Club', 'www.samsclub.com.br'], ['Atacadão', 'www.atacadao.com.br'],
  ['PB Kids', 'www.pbkids.com.br'], ['Telhanorte', 'www.telhanorte.com.br'], ['Obramax', 'www.obramax.com.br'],
  ['Drogarias Pacheco', 'www.drogariaspacheco.com.br'], ['Drogaria Venancio', 'www.drogariavenancio.com.br'], ['Extrafarma', 'www.extrafarma.com.br'],
  ['Hering', 'www.hering.com.br'], ['Farm Rio', 'www.farmrio.com.br'], ['Animale', 'www.animale.com.br'], ['Osklen', 'www.osklen.com.br'],
  ['Malwee', 'www.malwee.com.br'], ['TNG', 'www.tng.com.br'], ['Lojas Pompeia', 'www.lojaspompeia.com'], ['Vivara', 'www.vivara.com.br'],
  ['Mizuno', 'www.mizuno.com.br'], ['Olympikus', 'www.olympikus.com.br'], ['Fila', 'www.fila.com.br'], ['Under Armour', 'www.underarmour.com.br'],
  ['New Balance', 'www.newbalance.com.br'], ['Usaflex', 'www.usaflex.com.br'],
  ['Compra Certa', 'www.compracerta.com.br'], ['KitchenAid', 'www.kitchenaid.com.br'], ['Britânia', 'www.britania.com.br'], ['Oster', 'www.oster.com.br'],
  ['Arno', 'www.arno.com.br'], ['Walita', 'www.walita.com.br'], ['Brinox', 'www.brinox.com.br'], ['Oxford Porcelanas', 'www.oxfordporcelanas.com.br'],
  ['Ibyte', 'www.ibyte.com.br'], ['Multiloja', 'www.multiloja.com.br'], ['DPaschoal', 'www.dpaschoal.com.br'],
  ['Océane', 'www.oceane.com.br'], ['Amo Beleza', 'www.amobeleza.com.br'],
].map(([nome, dominio]) => [nome, dominio, 'vtex']).concat([
  ['Max Titanium', 'www.maxtitanium.com.br', 'vtex-legado'], ['Lojas Rede', 'www.lojasrede.com.br', 'vtex-legado'],
  ['Lupo', 'www.lupo.com.br', 'shopify'], ['Dular', 'www.dular.com.br', 'shopify'],
]);
const versaoSementes = +(banco.meta.ler('sementes') || (banco.lojas.todas().length ? 1 : 0));
for (const [v, lista] of [[1, SEMENTES], [2, SEMENTES_2]]) {
  if (versaoSementes >= v) continue;
  for (const [nome, dominio, plataforma, urls] of lista) if (!banco.lojas.porDominio(dominio)) banco.lojas.criar({ nome, dominio, plataforma, urls });
}
banco.meta.gravar('sementes', 2);

// ---------- modo só tecnologia ----------
// especializadas: tudo que não for claramente outra coisa entra; mistas: só entra o que é claramente tecnologia
const ESPECIALIZADAS = ['www.kabum.com.br', 'www.pichau.com.br', 'www.ibyte.com.br', 'www.motorola.com.br', 'www.waz.com.br', 'www.aiwa.com.br', 'www.vaio.com.br'];
const MISTAS_COM_TECNOLOGIA = ['www.carrefour.com.br', 'www.americanas.com.br', 'www.casaevideo.com.br', 'www.lojasmm.com', 'www.multiloja.com.br',
  'www.samsclub.com.br', 'www.multilaser.com.br', 'www.philco.com.br', 'www.britania.com.br', 'www.fujioka.com.br', 'www.promobit.com.br'];
const KABUM_TEC = ['hardware/placa-de-video-vga', 'hardware/processadores', 'hardware/placas-mae', 'hardware/memoria-ram', 'hardware/ssd-2-5', 'hardware/fontes',
  'computadores/notebooks', 'computadores/monitores', 'computadores/pc', 'celular-smartphone/smartphones', 'tablets-ipads-e-e-readers', 'perifericos', 'gamer',
  'tv', 'audio', 'cameras-e-drones', 'conectividade'].map(c => `https://www.kabum.com.br/${c}?page_number=1&page_size=100`);
const PICHAU_TEC = ['hardware/placa-de-video', 'hardware/processadores', 'hardware/memorias', 'hardware/ssd', 'monitores', 'perifericos', 'notebooks', 'computadores']
  .map(c => `https://www.pichau.com.br/${c}`);
const manter = (p, foco) => { const t = ehTecnologia(p); return t === true || (t === null && foco === 'tecnologia'); };

if (cfg.apenasTecnologia && banco.meta.ler('tecnologia') !== '1') {
  for (const [nome, dominio] of [['WAZ', 'www.waz.com.br'], ['Fujioka', 'www.fujioka.com.br'], ['Aiwa', 'www.aiwa.com.br'], ['VAIO', 'www.vaio.com.br']])
    if (!banco.lojas.porDominio(dominio)) banco.lojas.criar({ nome, dominio, plataforma: 'vtex' });
  for (const l of banco.lojas.todas()) {
    const esp = ESPECIALIZADAS.includes(l.dominio), mista = MISTAS_COM_TECNOLOGIA.includes(l.dominio);
    const campos = { foco: esp ? 'tecnologia' : 'misto', ativo: esp || mista || l.plataforma === 'avulso' };
    if (l.dominio === 'www.kabum.com.br') campos.urls = KABUM_TEC;
    if (l.dominio === 'www.pichau.com.br') campos.urls = PICHAU_TEC;
    if (esp || mista) campos.coletado_em = 0; // relê já no novo modo
    banco.lojas.atualizar(l.id, campos);
  }
  const r = banco.purgar(manter, { pausadas: true });
  console.log(`Modo só tecnologia: ${r.apagados} produtos de outras categorias removidos, ${r.restantes} mantidos.`);
  banco.meta.gravar('tecnologia', '1');
} else if (cfg.apenasTecnologia) {
  // o classificador pode ter melhorado desde a última vez: tira o que deixou de ser tecnologia
  const r = banco.purgar(manter);
  if (r.apagados) console.log(`${r.apagados} produtos que não são de tecnologia removidos.`);
}

// ---------- coleta ----------
const status = { rodando: false, ultimaRodada: 0, buscandoAoVivo: null };

function enviarAlertas(novos) {
  // a calibração da loja pode ter rebaixado o alerta depois que ele foi gerado
  const valeAinda = a => { const s = banco.seloAtual(a.produtoId); return s && (a.tipo !== 'bug' || (s.selo === 'bug' && s.selo_nivel >= a.nivel)); };
  const importantes = novos.filter(a => (a.nivel >= 3 || a.favorito || a.interesse) && valeAinda(a));
  for (const a of importantes.slice(0, 8)) {
    notificar({ ...a, nome: `${a.nome} · ${a.loja}`, motivo: a.interesse && !a.favorito ? `${a.motivo} — você segue "${a.interesse}"` : a.motivo }, cfg);
  }
  if (importantes.length > 8) notificar({ tipo: 'desconto', nivel: 2, nome: 'Monitor de Preços', motivo: `mais ${importantes.length - 8} alertas no site`, url: `http://localhost:${cfg.porta}/#/alertas` }, cfg);
}

async function coletarLoja(loja, opcoes = {}) {
  const fn = COLETORES[loja.plataforma];
  if (!fn) return { n: 0, novos: [] };
  const lista = banco.interesses.todos();
  // loja mista com catálogo público: em vez das ofertas gerais (móveis, roupa...), pesquisa termos de tecnologia
  const porTermos = cfg.apenasTecnologia && loja.foco !== 'tecnologia' && ['vtex', 'vtex-legado', 'shopify'].includes(loja.plataforma);
  const termos = opcoes.termos ?? [...(porTermos ? TERMOS : []), ...lista.map(i => i.termo)];
  let n = 0;
  const novos = [];
  const inicio = Date.now();
  banco.lojas.atualizar(loja.id, { coletando: 1 });
  try {
    for await (const lote of fn(loja, { termos, paginas: cfg.paginasPorLoja, esperaMs: cfg.esperaMs, soTermos: !!opcoes.soTermos || porTermos, comDesconto: porTermos && !opcoes.soTermos })) {
      banco.db.exec('BEGIN');
      try {
        for (const p of lote) {
          if (cfg.apenasTecnologia && !manter(p, loja.foco)) continue;
          novos.push(...banco.registrar(loja, p, cfg.limites, lista)); n++;
        }
        banco.db.exec('COMMIT');
      } catch (e) { banco.db.exec('ROLLBACK'); throw e; }
    }
    if (!opcoes.soTermos) {
      banco.lojas.atualizar(loja.id, { erro: null, coletado_em: Date.now(), produtos_ultima: n });
      banco.calibrarLoja(loja, cfg.limites, inicio);
    }
  } catch (e) {
    if (!opcoes.soTermos) banco.lojas.atualizar(loja.id, { erro: e.message, coletado_em: Date.now(), produtos_ultima: n });
    console.log(`  ✗ ${loja.nome}: ${e.message}`);
  } finally {
    banco.lojas.atualizar(loja.id, { coletando: 0 });
  }
  if (!opcoes.soTermos) console.log(`  ${loja.nome}: ${n} produtos${novos.length ? `, ${novos.length} alertas` : ''}`);
  return { n, novos };
}

async function emParalelo(itens, max, fn) {
  const fila = [...itens];
  await Promise.all(Array.from({ length: Math.min(max, fila.length) }, async () => { while (fila.length) await fn(fila.shift()); }));
}

async function rodada(forcar = false) {
  if (status.rodando) return;
  status.rodando = true;
  try {
    const agora = Date.now();
    const vencidas = banco.lojas.todas().filter(l => l.ativo && (forcar || agora - l.coletado_em >= cfg.intervaloMin * 60e3));
    if (!vencidas.length) return;
    console.log(`\n[${new Date().toLocaleTimeString('pt-BR')}] lendo ${vencidas.length} lojas…`);
    const novos = [];
    await emParalelo(vencidas, cfg.lojasEmParalelo, async l => novos.push(...(await coletarLoja(l)).novos));
    enviarAlertas(novos);
    status.ultimaRodada = Date.now();
  } finally { status.rodando = false; }
}

// pesquisa um termo agora em todas as lojas com catálogo público
async function buscarAoVivo(termo) {
  const alvo = banco.lojas.todas().filter(l => l.ativo && ['vtex', 'vtex-legado', 'shopify'].includes(l.plataforma));
  status.buscandoAoVivo = termo;
  let n = 0;
  const novos = [];
  try {
    await Promise.all(alvo.map(async l => { const r = await coletarLoja(l, { termos: [termo], soTermos: true }); n += r.n; novos.push(...r.novos); }));
  } finally { status.buscandoAoVivo = null; }
  enviarAlertas(novos);
  return { lojas: alvo.length, produtos: n };
}

// procura o mesmo produto (EAN) em todas as lojas VTEX e grava o que achar
async function compararEan(ean, excetoLoja = null) {
  const alvo = banco.lojas.todas().filter(l => l.ativo && ['vtex', 'vtex-legado'].includes(l.plataforma) && l.id !== excetoLoja);
  const lista = banco.interesses.todos();
  const novos = [];
  let achados = 0;
  await emParalelo(alvo, 12, async l => {
    try {
      const ps = await buscarEan(l, ean);
      for (const p of ps) { novos.push(...banco.registrar(l, p, cfg.limites, lista)); achados++; }
    } catch {}
  });
  return { achados, novos };
}

// ---------- revisão rápida de bugs ----------
// bugs costumam durar minutos: confere de novo os suspeitos e, se tiverem EAN, compara com as outras lojas
status.revisando = false;
async function revisarBugs() {
  if (status.revisando) return;
  status.revisando = true;
  const novos = [];
  try {
    const lista = banco.interesses.todos();
    const porLoja = new Map();
    for (const p of banco.paraRevisar(60)) (porLoja.get(p.loja_id) || porLoja.set(p.loja_id, []).get(p.loja_id)).push(p);
    await emParalelo([...porLoja], 6, async ([lojaId, ps]) => {
      const loja = banco.lojas.uma(lojaId);
      if (!loja?.ativo) return;
      for (const antigo of ps) {
        try {
          const p = await lerProduto(loja, antigo);
          if (p) novos.push(...banco.registrar(loja, { ...p, chave: antigo.id.slice(String(loja.id).length + 1) }, cfg.limites, lista, { conferido: true }));
          else banco.marcarIndisponivel(antigo.id);
        } catch {} // loja fora do ar: tenta de novo na próxima revisão
        await new Promise(r => setTimeout(r, 700));
      }
    });
    // comparação entre lojas dos suspeitos novos: um bug confirmado por outras lojas sobe para nível 3
    for (const p of banco.paraComparar(cfg.comparacoesPorRevisao)) {
      banco.marcarComparado(p.id);
      const r = await compararEan(p.ean, p.loja_id);
      novos.push(...r.novos);
      const loja = banco.lojas.uma(p.loja_id);
      const atual = banco.produto(p.id);
      if (loja && atual && r.achados) {
        novos.push(...banco.registrar(loja, {
          chave: p.id.slice(String(loja.id).length + 1), nome: atual.nome, marca: atual.marca, categoria: atual.categoria, url: atual.url,
          imagem: atual.imagem, preco: atual.preco, precoDe: atual.preco_de, precoPix: atual.preco_pix, estoque: atual.estoque, ean: atual.ean,
        }, cfg.limites, lista));
      }
    }
  } finally { status.revisando = false; }
  enviarAlertas(novos);
}

// ---------- cupons ----------
async function atualizarCupons() {
  const vencidas = banco.lojas.todas().filter(l => l.ativo && Date.now() - (l.cupons_em || 0) >= cfg.cuponsHoras * 3600e3);
  await emParalelo(vencidas, 3, async l => {
    try { banco.cupons.substituir(l.id, await cuponsDaLoja(l)); } catch {}
    await new Promise(r => setTimeout(r, 1500));
  });
}

// ---------- resumo diário ----------
function textoResumo() {
  const r = banco.resumoDiario();
  const url = `http://localhost:${cfg.porta}`;
  const linha = p => `• ${p.nome.slice(0, 70)} — ${R(p.preco)}${p.preco_anterior && p.preco < p.preco_anterior ? ` (era ${R(p.preco_anterior)})` : p.preco_de ? ` (de ${R(p.preco_de)})` : ''} · ${p.loja}\n  ${p.url}`;
  const partes = [];
  if (r.bugs.length) partes.push(`🚨 Possíveis bugs de preço\n${r.bugs.map(p => `${linha(p)}\n  ${p.selo_motivo}`).join('\n')}`);
  if (r.favoritos.length) partes.push(`♥ Seus favoritos que baixaram\n${r.favoritos.map(p => `• ${p.nome.slice(0, 70)} — ${R(p.preco)} (favoritou a ${R(p.preco_inicial)}) · ${p.loja}`).join('\n')}`);
  const segue = r.interesses.filter(i => i.melhor);
  if (segue.length) partes.push(`🔎 Buscas que você segue\n${segue.map(i => `• ${i.termo}: ${i.melhor.nome.slice(0, 60)} — ${R(i.melhor.preco)} · ${i.melhor.loja}`).join('\n')}`);
  if (r.entreLojas.length) partes.push(`🏷 Bem mais barato que nas outras lojas\n${r.entreLojas.map(p => `${linha(p)}\n  outras lojas a partir de ${R(p.menor_outras)}`).join('\n')}`);
  if (r.quedas.length) partes.push(`📉 Maiores quedas das últimas 24h\n${r.quedas.map(linha).join('\n')}`);
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return { titulo: `Resumo do Monitor de Preços — ${hoje}`, corpo: partes.join('\n\n') || 'Nada de especial nas últimas 24h.', url, dados: r };
}
const R = v => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

async function talvezEnviarResumo() {
  const rd = cfg.resumoDiario;
  if (!rd?.ativo) return;
  const agora = new Date();
  const hoje = agora.toISOString().slice(0, 10);
  if (agora.getHours() < rd.hora || banco.meta.ler('resumo_enviado') === hoje) return;
  banco.meta.gravar('resumo_enviado', hoje);
  await enviarTexto(textoResumo(), cfg);
}

// ---------- servidor ----------
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const SITE = path.join(__dirname, 'site');

function corpo(req) {
  return new Promise((res, rej) => {
    let b = '';
    req.on('data', d => { b += d; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { res(b ? JSON.parse(b) : {}); } catch (e) { rej(e); } });
  });
}
function json(res, cod, obj) {
  res.writeHead(cod, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

async function api(req, res, u) {
  const m = (re) => u.pathname.match(re);
  const metodo = req.method;
  let r;

  if (metodo === 'GET' && u.pathname === '/api/resumo') return json(res, 200, { ...banco.resumo(), status, interesses: banco.interesses.todos() });
  if (metodo === 'GET' && u.pathname === '/api/produtos') return json(res, 200, banco.buscar(Object.fromEntries(u.searchParams)));
  if (metodo === 'GET' && (r = m(/^\/api\/produtos\/(.+)$/))) {
    const p = banco.produto(decodeURIComponent(r[1]));
    return p ? json(res, 200, p) : json(res, 404, { erro: 'produto não encontrado' });
  }
  if (metodo === 'GET' && u.pathname === '/api/categorias') return json(res, 200, banco.categorias(u.searchParams.get('loja')));
  if (metodo === 'GET' && u.pathname === '/api/alertas') return json(res, 200, banco.alertas(+u.searchParams.get('limite') || 150, u.searchParams.get('fav') === '1'));
  if (metodo === 'GET' && u.pathname === '/api/status') return json(res, 200, status);

  // favoritos
  if ((r = m(/^\/api\/favoritos\/(.+)$/))) {
    const id = decodeURIComponent(r[1]);
    if (metodo === 'PUT') { const b = await corpo(req); banco.favoritos.adicionar(id, parseFloat(b.precoAlvo) || null); return json(res, 200, { ok: true }); }
    if (metodo === 'DELETE') { banco.favoritos.remover(id); return json(res, 200, { ok: true }); }
  }

  // buscas seguidas
  if (metodo === 'GET' && u.pathname === '/api/interesses') return json(res, 200, banco.interesses.todos());
  if (metodo === 'POST' && u.pathname === '/api/interesses') {
    const b = await corpo(req);
    const termo = String(b.termo || '').trim();
    if (termo.length < 2) return json(res, 400, { erro: 'digite o que você quer seguir' });
    const id = banco.interesses.criar(termo, parseFloat(b.precoMax) || null);
    buscarAoVivo(termo).catch(() => {});
    return json(res, 200, { id });
  }
  if (metodo === 'DELETE' && (r = m(/^\/api\/interesses\/(\d+)$/))) { banco.interesses.apagar(+r[1]); return json(res, 200, { ok: true }); }

  if (metodo === 'POST' && u.pathname === '/api/buscar') {
    const b = await corpo(req);
    if (String(b.q || '').trim().length < 2) return json(res, 400, { erro: 'busca muito curta' });
    return json(res, 200, await buscarAoVivo(String(b.q).trim()));
  }

  // lojas
  if (metodo === 'GET' && u.pathname === '/api/lojas') return json(res, 200, banco.lojas.todas());
  if (metodo === 'POST' && u.pathname === '/api/lojas') {
    const b = await corpo(req);
    const d = await detectar(b.entrada);
    const existente = banco.lojas.porDominio(d.dominio);
    let id;
    if (existente && ['pagina', 'avulso'].includes(existente.plataforma) && d.urls) {
      if (existente.urls.includes(d.urls[0])) return json(res, 400, { erro: 'essa página já está sendo monitorada' });
      banco.lojas.atualizar(existente.id, { urls: [...existente.urls, ...d.urls], plataforma: existente.plataforma === 'avulso' && d.plataforma === 'pagina' ? 'pagina' : existente.plataforma });
      id = existente.id;
    } else if (existente) {
      return json(res, 400, { erro: `${existente.nome} já está na lista` });
    } else {
      id = banco.lojas.criar({ nome: String(b.nome || '').trim() || nomeDaLoja(d.dominio), ...d });
    }
    coletarLoja(banco.lojas.uma(id)).then(r => enviarAlertas(r.novos));
    return json(res, 200, banco.lojas.uma(id));
  }
  if ((r = m(/^\/api\/lojas\/(\d+)(\/coletar)?$/))) {
    const loja = banco.lojas.uma(+r[1]);
    if (!loja) return json(res, 404, { erro: 'loja não encontrada' });
    if (metodo === 'POST' && r[2]) { if (!loja.coletando) coletarLoja(loja).then(x => enviarAlertas(x.novos)); return json(res, 200, { ok: true }); }
    if (metodo === 'PATCH') {
      const b = await corpo(req);
      const campos = {};
      if ('ativo' in b) campos.ativo = !!b.ativo;
      if (b.nome) campos.nome = String(b.nome).slice(0, 60);
      if (['tecnologia', 'misto'].includes(b.foco)) { campos.foco = b.foco; campos.coletado_em = 0; }
      banco.lojas.atualizar(loja.id, campos);
      return json(res, 200, banco.lojas.uma(loja.id));
    }
    if (metodo === 'DELETE') { banco.lojas.apagar(loja.id); return json(res, 200, { ok: true }); }
  }
  if (metodo === 'POST' && u.pathname === '/api/coletar') { rodada(true); return json(res, 200, { ok: true }); }

  // comparar um produto em todas as lojas (pelo EAN)
  if (metodo === 'POST' && (r = m(/^\/api\/comparar\/(.+)$/))) {
    const p = banco.produto(decodeURIComponent(r[1]));
    if (!p) return json(res, 404, { erro: 'produto não encontrado' });
    if (!p.ean) return json(res, 400, { erro: 'este produto não tem código de barras (EAN) para comparar' });
    const x = await compararEan(p.ean, p.loja_id);
    banco.marcarComparado(p.id);
    enviarAlertas(x.novos);
    return json(res, 200, { achados: x.achados, produto: banco.produto(p.id) });
  }
  if (metodo === 'POST' && u.pathname === '/api/revisar') { revisarBugs(); return json(res, 200, { ok: true }); }

  // resumo diário
  if (metodo === 'GET' && u.pathname === '/api/resumo-diario') {
    const t = textoResumo();
    return json(res, 200, { ...t.dados, texto: t.corpo, titulo: t.titulo, hora: cfg.resumoDiario?.hora, ativo: !!cfg.resumoDiario?.ativo, enviadoEm: banco.meta.ler('resumo_enviado') });
  }
  if (metodo === 'POST' && u.pathname === '/api/resumo-diario/enviar') { await enviarTexto(textoResumo(), cfg); return json(res, 200, { ok: true }); }
  if (metodo === 'POST' && u.pathname === '/api/testar') {
    const b = await corpo(req);
    return json(res, 200, await extrair(b.url, { tipo: b.tipo || 'produto' }));
  }
  json(res, 404, { erro: 'não encontrado' });
}

// ---------- acesso pelo celular ----------
const CHAVE = celular.garantirChave(ARQ_CONFIG);
const ORIGEM_APP = new URL(cfg.celular.app).origin;
status.celular = { tunel: null, link: null, erro: null };
// pedidos que chegam pelo túnel trazem o cabeçalho cf-connecting-ip; os do próprio PC, não
const peloTunel = req => !!req.headers['cf-connecting-ip'];
const autorizado = req => !peloTunel(req) || celular.chaveConfere(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''), CHAVE);
function dadosPareamento() {
  const gist = celular.lerConfig(ARQ_CONFIG).celular?.gist;
  const codigo = gist ? `${gist}.${CHAVE}` : null;
  return { ativo: !!cfg.celular.ativo, app: cfg.celular.app, tunel: status.celular.tunel, codigo, link: codigo ? `${cfg.celular.app}#parear=${codigo}` : null, erro: status.celular.erro };
}

const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  // o app do GitHub Pages chama a API de outro endereço
  const origem = req.headers.origin;
  if (origem && (origem === ORIGEM_APP || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origem))) {
    res.setHeader('Access-Control-Allow-Origin', origem);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  try {
    if (u.pathname.startsWith('/api/')) {
      if (!autorizado(req)) return json(res, 401, { erro: 'chave de acesso inválida: pareie o celular de novo' });
      if (u.pathname === '/api/celular') {
        // o código de pareamento só aparece no próprio PC
        if (peloTunel(req)) return json(res, 403, { erro: 'disponível só no PC' });
        return json(res, 200, dadosPareamento());
      }
      return await api(req, res, u);
    }
    const arq = path.join(SITE, path.normalize(u.pathname === '/' ? 'index.html' : u.pathname).replace(/^(\.\.[/\\])+/, ''));
    if (!arq.startsWith(SITE) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404); return res.end('não encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(arq).pipe(res);
  } catch (e) {
    json(res, 400, { erro: e.message });
  }
});

// ---------- linha de comando ----------
const [cmd, ...args] = process.argv.slice(2);
(async () => {
  if (cmd === 'testar') {
    console.log(JSON.stringify(await extrair(args[0], { tipo: args[1] || 'produto' }), null, 2));
    return;
  }
  if (cmd === 'uma-vez') { await rodada(false); await new Promise(r => setTimeout(r, 3000)); return; }
  const porta = process.env.PORT || cfg.porta;
  servidor.listen(porta, '127.0.0.1', () => {
    console.log(`\nMonitor de Preços em http://localhost:${porta}`);
    console.log(`${banco.lojas.todas().length} lojas, relidas a cada ${cfg.intervaloMin} min. Ctrl+C para sair.`);
    if (process.env.OPEN !== '0' && process.platform === 'win32') require('child_process').spawn('cmd', ['/c', 'start', '', `http://localhost:${porta}`], { stdio: 'ignore', detached: true }).unref();
    if (cfg.celular.ativo && process.env.TUNNEL !== '0') {
      celular.abrirTunel(porta, url => {
        status.celular.tunel = url;
        status.celular.erro = null;
        celular.publicarEndereco(ARQ_CONFIG, url).then(() => {
          const d = dadosPareamento();
          status.celular.link = d.link;
          console.log(`\nCelular: abra o monitor no site e toque em "Celular" para parear (link também em ${path.join(__dirname, 'link-celular.txt')}).`);
          fs.writeFileSync(path.join(__dirname, 'link-celular.txt'), d.link + '\n');
        }).catch(e => { status.celular.erro = e.message; console.log('  celular:', e.message); });
      }, e => { status.celular.erro = e.message; console.log('  celular:', e.message); });
    }
  });
  rodada(false);
  setInterval(() => rodada(false), 60e3);
  setInterval(() => revisarBugs().catch(e => console.log('  revisão:', e.message)), cfg.revisaoBugsMin * 60e3);
  setTimeout(() => revisarBugs().catch(() => {}), 90e3);
  atualizarCupons().catch(() => {});
  setInterval(() => atualizarCupons().catch(() => {}), 30 * 60e3);
  setInterval(() => talvezEnviarResumo().catch(e => console.log('  resumo:', e.message)), 60e3);
})().catch(e => { console.error('erro:', e.message); process.exit(1); });
