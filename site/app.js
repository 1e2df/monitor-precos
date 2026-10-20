// Monitor de Preços — site (sem frameworks)
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const R = v => (v == null ? '—' : BRL.format(v));
const pct = v => Math.round(v * 100) + '%';
// etiqueta de preço do varejo: "R$" pequeno, inteiro grande, centavos sobrescritos
const partes = v => { const [i, c] = v.toFixed(2).split('.'); return [Number(i).toLocaleString('pt-BR'), c]; };
const etiqueta = (v, tam = 'media', bug = false) => {
  if (v == null) return '';
  const [i, c] = partes(v);
  return `<span class="etq ${tam} ${bug ? 'bug' : ''}" aria-label="${R(v)}"><span class="rs">R$</span><span class="int">${i}</span><span class="cts">,${c}</span></span>`;
};
const quando = t => {
  if (!t) return 'nunca';
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return Math.round(s / 60) + ' min atrás';
  if (s < 86400) return Math.round(s / 3600) + ' h atrás';
  return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

async function api(url, opcoes = {}) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opcoes, body: opcoes.body && JSON.stringify(opcoes.body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || `erro ${r.status}`);
  return j;
}

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3200);
}

// ---------- tema ----------
const raiz = document.documentElement;
try { const t = localStorage.getItem('tema'); if (t) raiz.dataset.tema = t; } catch {}
$('#tema').onclick = () => {
  const escuro = raiz.dataset.tema ? raiz.dataset.tema === 'escuro' : matchMedia('(prefers-color-scheme: dark)').matches;
  raiz.dataset.tema = escuro ? 'claro' : 'escuro';
  try { localStorage.setItem('tema', raiz.dataset.tema); } catch {}
};

// ---------- ícones ----------
const ICO = {
  coracao: '<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z"/></svg>',
  externo: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>',
  raio: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  recarregar: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5"/></svg>',
  filtro: '<svg viewBox="0 0 24 24"><path d="M3 5h18M6 12h12M10 19h4"/></svg>',
  seguir: '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0"/></svg>',
};

// ---------- cartão de produto ----------
const produtosVistos = new Map(); // id -> produto (para o modal abrir na hora)

function selos(p) {
  const s = [];
  if (p.selo === 'bug') s.push(`<span class="selo ${p.selo_nivel >= 3 ? 'bug' : 'bug2'}">${p.selo_nivel >= 3 ? 'Bug de preço' : 'Bug?'}</span>`);
  if (p.selo === 'alvo') s.push('<span class="selo alvo">Preço alvo</span>');
  if (p.selo === 'minimo') s.push('<span class="selo minimo">Menor preço</span>');
  // o desconto sobre o "de" já aparece no preço riscado; o selo fica só para queda real no histórico
  if (p.queda >= 0.1) s.push(`<span class="selo queda">▼ ${pct(p.queda)}</span>`);
  return s.join('');
}

function variacao(p) {
  if (p.favorito && p.preco_inicial && Math.abs(p.preco / p.preco_inicial - 1) >= 0.01) {
    const d = p.preco / p.preco_inicial - 1;
    return `<span class="var ${d < 0 ? 'cai' : 'sobe'}">${d < 0 ? '▼' : '▲'} ${pct(Math.abs(d))} desde que favoritou</span>`;
  }
  if (p.preco_anterior && Math.abs(p.preco / p.preco_anterior - 1) >= 0.01) {
    const d = p.preco / p.preco_anterior - 1;
    return `<span class="var ${d < 0 ? 'cai' : 'sobe'}">${d < 0 ? '▼' : '▲'} ${pct(Math.abs(d))} (era ${R(p.preco_anterior)})</span>`;
  }
  return '';
}

// i: posição na lista, para os cartões entrarem em sequência
function cartao(p, i = 0) {
  produtosVistos.set(p.id, p);
  const bugConfirmado = p.selo === 'bug' && p.selo_nivel >= 3 && p.disponivel !== 0;
  // foto na prateleira; embaixo, a régua de metal e a etiqueta eletrônica presa nela (LED aceso nos bugs confirmados)
  return `<article class="card" data-id="${esc(p.id)}">
    <div class="foto">${p.imagem ? `<img src="${esc(p.imagem)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="sem-foto">sem foto</span>'}
      <button class="coracao ${p.favorito ? 'on' : ''}" data-fav="${esc(p.id)}" aria-label="Favoritar">${ICO.coracao}</button>
    </div>
    <div class="regua"></div>
    <div class="esl">${bugConfirmado ? '<span class="led" title="Bug de preço confirmado"></span>' : ''}
      <div class="tela">
        <div class="selos">${selos(p)}</div>
        <span class="loja-chip">${esc(p.loja)}${p.n_cupons ? ' <span class="tag-cupom" title="Esta loja tem cupons ativos">cupom</span>' : ''}</span>
        <span class="nome">${esc(p.nome)}</span>
        <div class="precos">
          ${p.preco_de ? `<span class="de">${R(p.preco_de)}</span>` : ''}
          ${etiqueta(p.preco, 'media', bugConfirmado)}
          ${p.preco_pix ? `<div class="pix">${R(p.preco_pix)} no Pix</div>` : ''}
          ${variacao(p)}
          ${entreLojas(p)}
          ${p.selo === 'bug' && p.selo_em ? `<span class="ativo-ha">${p.disponivel === 0 ? 'Esgotou' : 'Bug ativo há ' + duracao(p.selo_em)}</span>` : ''}
        </div>
      </div>
    </div>
  </article>`;
}

// "Mais barato de 4 lojas" / "Em 3 lojas, a partir de R$ X"
function entreLojas(p) {
  if (!(p.n_lojas >= 2)) return '';
  if (p.menor_outras == null || p.preco <= p.menor_outras) {
    const dif = p.menor_outras ? 1 - p.preco / p.menor_outras : 0;
    return `<span class="lojas-tag melhor">Mais barato de ${p.n_lojas} lojas${dif >= 0.05 ? `, ${pct(dif)} abaixo` : ''}</span>`;
  }
  return `<span class="lojas-tag">Em ${p.n_lojas} lojas, a partir de ${R(p.menor_outras)}</span>`;
}

const duracao = t => {
  const m = Math.max(1, Math.round((Date.now() - t) / 60000));
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${Math.round(m / 1440)} dias`;
};

const grade = ps => `<div class="grade">${ps.map((p, i) => cartao(p, i)).join('')}</div>`;
const trilho = ps => `<div class="trilho-caixa">
    <button class="seta esq" aria-label="Anteriores"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
    <div class="trilho">${ps.map((p, i) => cartao(p, i)).join('')}</div>
    <button class="seta dir" aria-label="Próximos"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button></div>`;
const esqueletos = n => `<div class="grade">${'<div class="esqueleto"></div>'.repeat(n)}</div>`;

// setas dos trilhos: somem quando não há mais para onde rolar
function atualizarSetas(t) {
  const caixa = t.parentElement;
  if (!caixa?.classList.contains('trilho-caixa')) return;
  caixa.querySelector('.esq').disabled = t.scrollLeft < 8;
  caixa.querySelector('.dir').disabled = t.scrollLeft + t.clientWidth >= t.scrollWidth - 8;
}
document.addEventListener('scroll', e => { if (e.target.classList?.contains('trilho')) atualizarSetas(e.target); }, true);
new MutationObserver(() => document.querySelectorAll('.trilho').forEach(atualizarSetas)).observe(document.body, { childList: true, subtree: true });
document.addEventListener('click', e => {
  const s = e.target.closest('.seta');
  if (!s) return;
  e.stopPropagation();
  const t = s.parentElement.querySelector('.trilho');
  t.scrollBy({ left: (s.classList.contains('esq') ? -1 : 1) * t.clientWidth * 0.85, behavior: 'smooth' });
}, true);

// topo ganha borda e sombra quando a página rola
addEventListener('scroll', () => $('.topo').classList.toggle('rolou', scrollY > 8), { passive: true });


// cliques em qualquer cartão / coração
document.addEventListener('click', async e => {
  const fav = e.target.closest('[data-fav]');
  if (fav) {
    e.stopPropagation();
    const id = fav.dataset.fav;
    const on = !fav.classList.contains('on');
    try {
      await api(`/api/favoritos/${encodeURIComponent(id)}`, { method: on ? 'PUT' : 'DELETE', body: on ? {} : undefined });
      document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach(b => {
        b.classList.toggle('on', on);
        if (on) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
      });
      const p = produtosVistos.get(id); if (p) { p.favorito = on ? 1 : 0; if (on) p.preco_inicial = p.preco; }
      toast(on ? 'Adicionado aos favoritos' : 'Removido dos favoritos');
      atualizarContadores();
    } catch (err) { toast(err.message); }
    return;
  }
  const card = e.target.closest('.card[data-id]');
  if (card) abrirProduto(card.dataset.id);
});

// ---------- modal do produto ----------
const modal = $('#modal');
$('#fechar').onclick = () => modal.close();
modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });

async function abrirProduto(id) {
  const corpo = $('#modal-corpo');
  const rapido = produtosVistos.get(id);
  corpo.innerHTML = rapido ? fichaProduto({ ...rapido, historico: [] }, true) : '<div class="carregando">Carregando…</div>';
  if (!modal.open) modal.showModal();
  try {
    const p = await api(`/api/produtos/${encodeURIComponent(id)}`);
    produtosVistos.set(p.id, p);
    corpo.innerHTML = fichaProduto(p);
    ligarGrafico(corpo, p.historico);
    const cmp = $('#comparar', corpo);
    if (cmp) cmp.onclick = async () => {
      cmp.disabled = true; cmp.innerHTML = `${ICO.raio} Procurando nas lojas…`;
      try {
        const r = await api(`/api/comparar/${encodeURIComponent(p.id)}`, { method: 'POST' });
        toast(r.achados ? `Encontrado em mais ${r.achados} anúncio(s)` : 'Nenhuma outra loja vende este produto agora');
        abrirProduto(p.id);
      } catch (err) { toast(err.message); cmp.disabled = false; cmp.innerHTML = `${ICO.raio} Procurar em todas as lojas`; }
    };
    corpo.querySelectorAll('[data-copiar]').forEach(b => (b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copiar); toast(`Cupom ${b.dataset.copiar} copiado`); } catch { toast(b.dataset.copiar); }
    }));
    const f = $('.alvo-form', corpo);
    if (f) f.onsubmit = async ev => {
      ev.preventDefault();
      const alvo = parseFloat(f.alvo.value.replace(/\./g, '').replace(',', '.'));
      await api(`/api/favoritos/${encodeURIComponent(p.id)}`, { method: 'PUT', body: { precoAlvo: alvo || null } });
      toast(alvo ? `Você será avisado quando chegar em ${R(alvo)}` : 'Preço alvo removido');
      document.querySelectorAll(`[data-fav="${CSS.escape(p.id)}"]`).forEach(b => b.classList.add('on'));
      atualizarContadores();
    };
  } catch (err) { corpo.innerHTML = `<div class="vazio"><b>Não foi possível abrir</b>${esc(err.message)}</div>`; }
}

function fichaProduto(p, parcial = false) {
  const classe = { bug: 'bug', queda: 'queda', alvo: 'alvo', minimo: 'queda' }[p.selo] || '';
  return `<div class="prod">
    <div class="foto">${p.imagem ? `<img src="${esc(p.imagem)}" alt="" referrerpolicy="no-referrer">` : '<span class="mut">sem foto</span>'}</div>
    <div class="det">
      <span class="loja-chip">${esc(p.loja)}${p.categoria ? ', ' + esc(p.categoria) : ''}</span>
      <h2>${esc(p.nome)}</h2>
      <div>
        ${p.preco_de ? `<span class="de">${R(p.preco_de)}</span> <span class="var cai">${pct(p.desconto)} abaixo do preço "de"</span><br>` : ''}
        ${etiqueta(p.preco, 'media', p.selo === 'bug' && p.selo_nivel >= 3)}
        ${p.preco_pix ? `<div class="pix">${R(p.preco_pix)} no Pix</div>` : ''}
        ${variacao(p)}
      </div>
      ${p.selo_motivo ? `<div class="motivo-box ${classe}">${p.selo === 'bug' ? (p.selo_nivel >= 3 ? '<b>Provável bug de preço:</b> ' : '<b>Possível bug:</b> ') : ''}${esc(p.selo_motivo)}
        ${p.selo === 'bug' && p.selo_em ? `<div class="bug-status">${p.disponivel === 0 ? '<b>Esgotou ou saiu do ar</b>' : `<b>Ativo há ${duracao(p.selo_em)}</b> (desde ${new Date(p.selo_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`}${p.conferido_em ? `, conferido ${quando(p.conferido_em)}` : ''}${p.estoque ? `, ${p.estoque < 10 ? 'só ' : ''}${p.estoque} unidade${p.estoque > 1 ? 's' : ''}` : ''}</div>` : ''}
      </div>` : ''}
      <div class="stats">
        <div><span>Preço normal</span><b>${R(p.mediana)}</b></div>
        <div><span>Menor visto</span><b>${R(p.minimo)}</b></div>
        <div><span>Maior visto</span><b>${R(p.maximo)}</b></div>
      </div>
      ${parcial ? '<div class="carregando">carregando histórico…</div>' : grafico(p.historico)}
      <div class="prod-acoes">
        <a class="btn pri" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${ICO.externo} Ver na loja</a>
        <button class="btn ${p.favorito ? 'on' : ''}" data-fav="${esc(p.id)}">${ICO.coracao} ${p.favorito ? 'Favorito' : 'Favoritar'}</button>
        <form class="alvo-form"><input class="campo" name="alvo" inputmode="decimal" placeholder="Avise abaixo de R$" value="${p.preco_alvo ? String(p.preco_alvo).replace('.', ',') : ''}"><button class="btn">Definir alvo</button></form>
      </div>
      <span class="mut peq-txt">Visto ${quando(p.visto_em)}. Acompanhado desde ${p.criado_em ? new Date(p.criado_em).toLocaleDateString('pt-BR') : '—'}, com ${p.n_pontos || 0} ${p.n_pontos === 1 ? 'leitura' : 'leituras'} de preço.${p.ean ? ` Código de barras ${esc(p.ean)}` : ''}</span>
    </div>
  </div>
  ${parcial ? '' : comparacao(p)}
  ${p.cupons?.length ? `<div class="semelhantes"><h3>Cupons da ${esc(p.loja)}</h3><div class="cupons">${p.cupons.map(c => `<div class="cupom">
      <div><b>${esc(c.desconto || 'Cupom')}</b><span>${esc(c.titulo)}</span>${c.validade ? `<small>até ${new Date(c.validade).toLocaleDateString('pt-BR')}</small>` : ''}</div>
      <button class="btn peq" data-copiar="${esc(c.codigo)}">${esc(c.codigo)}</button></div>`).join('')}</div>
      <p class="mut peq-txt">Cupons coletados do Promobit; confira as regras na loja.</p></div>` : ''}
  ${p.semelhantes?.length ? `<div class="semelhantes"><h3>Ofertas parecidas</h3>${trilho(p.semelhantes)}</div>` : ''}`;
}

// mesmo produto (mesmo EAN) em outras lojas
function comparacao(p) {
  if (!p.ean) return '';
  const outras = (p.ofertas || []);
  const menor = Math.min(...outras.filter(o => o.disponivel !== 0).map(o => o.preco));
  return `<div class="semelhantes"><div class="secao-cab"><h3>Compare entre lojas</h3>
      <button class="btn peq" id="comparar">${ICO.raio} Procurar em todas as lojas</button></div>
    ${outras.length > 1 ? `<div class="comparar">${outras.map(o => `<a class="cmp-linha ${o.id === p.id ? 'atual' : ''} ${o.disponivel === 0 ? 'off' : ''}" href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">
        <span class="cmp-loja">${esc(o.loja)}</span>
        <span class="cmp-nome">${esc(o.nome)}</span>
        <span class="cmp-preco">${o.preco === menor ? etiqueta(o.preco, 'pequena') : `<b>${R(o.preco)}</b>`}${o.preco_pix ? `<small>${R(o.preco_pix)} no Pix</small>` : ''}</span>
      </a>`).join('')}</div>`
      : '<p class="mut peq-txt">Ainda não vimos este produto em outra loja. Clique em “Procurar em todas as lojas” para pesquisar o código de barras agora.</p>'}
  </div>`;
}

// o botão "Favoritar" do modal usa data-fav mas não é .coracao: mantém o texto em dia
new MutationObserver(() => {
  document.querySelectorAll('.prod-acoes [data-fav]').forEach(b => { b.innerHTML = `${ICO.coracao} ${b.classList.contains('on') ? 'Favorito' : 'Favoritar'}`; });
}).observe($('#modal-corpo'), { subtree: true, attributes: true, attributeFilter: ['class'] });

function grafico(h) {
  if (!h || h.length < 2) return `<div class="mut peq-txt">O gráfico aparece depois de algumas leituras de preço. O monitor relê as lojas a cada hora.</div>`;
  const W = 600, H = 180, pad = 8;
  const t0 = h[0].t, t1 = Math.max(Date.now(), h[h.length - 1].t);
  const ps = h.map(x => x.preco), mn = Math.min(...ps), mx = Math.max(...ps), d = mx - mn || mx * 0.1 || 1;
  const X = t => pad + ((t - t0) / (t1 - t0 || 1)) * (W - pad * 2);
  const Y = v => H - 24 - ((v - mn) / d) * (H - 48);
  // preço é degrau: fica igual até a próxima mudança
  let caminho = `M${X(h[0].t)},${Y(h[0].preco)}`;
  for (let i = 1; i < h.length; i++) caminho += ` H${X(h[i].t)} V${Y(h[i].preco)}`;
  caminho += ` H${X(t1)}`;
  const area = `${caminho} V${H - 20} H${X(h[0].t)} Z`;
  const fmt = t => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  return `<div class="grafico" data-pontos='${esc(JSON.stringify(h.map(x => [x.t, x.preco])))}'>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs><linearGradient id="gr" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#c4122f" stop-opacity=".18"/><stop offset="1" stop-color="#c4122f" stop-opacity="0"/></linearGradient></defs>
      <line x1="${pad}" x2="${W - pad}" y1="${Y(mn)}" y2="${Y(mn)}" stroke="var(--linha)" stroke-dasharray="4 4" stroke-width="1"/>
      <line x1="${pad}" x2="${W - pad}" y1="${Y(mx)}" y2="${Y(mx)}" stroke="var(--linha)" stroke-dasharray="4 4" stroke-width="1"/>
      <g class="revelar"><path d="${area}" fill="url(#gr)" stroke="none"/>
      <path d="${caminho}" stroke="var(--tinta)" stroke-width="2.4" vector-effect="non-scaling-stroke"/></g>
      <line class="cursor" x1="0" x2="0" y1="0" y2="${H - 20}" stroke="var(--grafite)" stroke-width="1" vector-effect="non-scaling-stroke" visibility="hidden"/>
      <text x="${W - pad}" y="${Y(mx) - 5}" text-anchor="end" font-size="11" fill="var(--grafite)" stroke="none">${R(mx)}</text>
      <text x="${W - pad}" y="${Y(mn) + 14}" text-anchor="end" font-size="11" fill="var(--grafite)" stroke="none">${R(mn)}</text>
      <text x="${pad}" y="${H - 4}" font-size="11" fill="var(--grafite)" stroke="none">${fmt(t0)}</text>
      <text x="${W - pad}" y="${H - 4}" text-anchor="end" font-size="11" fill="var(--grafite)" stroke="none">hoje</text>
    </svg><div class="dica" hidden></div></div>`;
}

function ligarGrafico(el, h) {
  const g = $('.grafico', el);
  if (!g || !h || h.length < 2) return;
  const svg = $('svg', g), dica = $('.dica', g), cursor = $('.cursor', g);
  const t0 = h[0].t, t1 = Math.max(Date.now(), h[h.length - 1].t), pad = 8, W = 600;
  svg.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const t = t0 + ((fx * W - pad) / (W - pad * 2)) * (t1 - t0);
    let p = h[0];
    for (const x of h) if (x.t <= t) p = x;
    cursor.setAttribute('x1', fx * W); cursor.setAttribute('x2', fx * W); cursor.setAttribute('visibility', 'visible');
    dica.hidden = false;
    dica.style.left = (e.clientX - r.left) + 'px'; dica.style.top = '30px';
    dica.textContent = `${R(p.preco)} em ${new Date(Math.min(t, Date.now())).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })}`;
  });
  svg.addEventListener('pointerleave', () => { dica.hidden = true; cursor.setAttribute('visibility', 'hidden'); });
}

// ---------- rotas ----------
const ROTAS = { '': inicio, catalogo, bugs, favoritos, alertas, lojas };
function rota() {
  const [caminho, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const nome = caminho.split('/')[0];
  const params = new URLSearchParams(qs || '');
  document.querySelectorAll('#abas a').forEach(a => a.classList.toggle('on', a.dataset.v === (nome || 'inicio')));
  if (modal.open) modal.close();
  (ROTAS[nome] || inicio)(params);
  window.scrollTo(0, 0);
}
addEventListener('hashchange', rota);
const ir = (pagina, params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== false)).toString();
  location.hash = `#/${pagina}${qs ? '?' + qs : ''}`;
};

$('#busca-topo').onsubmit = e => {
  e.preventDefault();
  const q = e.target.q.value.trim();
  ir('catalogo', { q });
};

// ---------- início ----------
// categorias do início: uma linha de texto, cada uma abre a busca
const ATALHOS = [['Notebooks', 'notebook'], ['Celulares', 'smartphone'], ['Placas de vídeo', 'placa de video'], ['Processadores', 'processador'],
  ['Monitores', 'monitor'], ['Smart TVs', 'smart tv'], ['Fones e caixas de som', 'fone de ouvido'], ['Consoles', 'console'],
  ['Mouses e teclados', 'mouse'], ['SSD', 'ssd'], ['Smartwatches', 'smartwatch']];

// o produto da vitrine: o bug mais forte; sem bug, a maior queda; sem queda, a maior diferença entre lojas
function destaque(r) {
  const b = r.bugsLista.find(p => p.selo_nivel >= 3) || r.bugsLista[0];
  if (b) return { p: b, titulo: b.selo_nivel >= 3 ? 'O maior bug de preço agora' : 'O preço mais suspeito agora', antes: b.menor_outras > b.preco ? b.menor_outras : b.preco_anterior > b.preco ? b.preco_anterior : b.preco_de, bug: b.selo_nivel >= 3 };
  const q = r.quedas[0];
  if (q) return { p: q, titulo: 'A maior queda de preço agora', antes: q.preco_anterior };
  const e = r.entreLojas[0];
  if (e) return { p: e, titulo: 'Bem mais barato que nas outras lojas', antes: e.menor_outras };
  const d = r.descontos[0];
  return d ? { p: d, titulo: 'O melhor desconto agora', antes: d.preco_de } : null;
}

function vitrine(r) {
  const v = destaque(r);
  if (!v) return '';
  const { p } = v;
  produtosVistos.set(p.id, p);
  const nome = p.nome.length > 72 ? p.nome.slice(0, 72).replace(/\s+\S*$/, '') + '…' : p.nome;
  // sem preço anterior/"de", usa a referência citada no motivo ("…nas outras 2 lojas (R$ 274,45)")
  const citado = (m => m ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) : null)((p.selo_motivo || '').match(/R\$\s?([\d.]+,\d{2})/));
  const antes = [v.antes, citado].find(x => x && x > p.preco * 1.02) || null;
  // destaca o número do motivo ("60% mais barato…") em vermelho
  const motivo = esc((p.selo_motivo || '').split(';')[0]).replace(/^(\d+%)/, '<b>$1</b>');
  // a vitrine é uma etiqueta eletrônica grande: moldura, LED piscando e a tela que "atualiza" ao carregar
  return `<section class="vitrine esl">
    ${v.bug ? '<span class="led" title="Bug de preço confirmado"></span>' : ''}
    <div class="tela">
      <div class="palco" data-abrir="${esc(p.id)}">${p.imagem ? `<img src="${esc(p.imagem)}" alt="${esc(p.nome)}" referrerpolicy="no-referrer">` : ''}</div>
      <div>
        <p class="titulo">${v.titulo}</p>
        <h1>${esc(nome)}</h1>
        ${motivo ? `<p class="porque">${motivo}.</p>` : ''}
        ${antes ? `<span class="de-v">${R(antes)}</span>` : ''}
        ${etiqueta(p.preco, 'grande', v.bug)}
        <div class="acoes-v"><button class="btn pri" data-abrir="${esc(p.id)}">Ver o produto</button><span class="loja-v">na ${esc(p.loja)}</span></div>
        <p class="rodape-v">Preço lido ${quando(p.visto_em)}${p.conferido_em ? `, conferido ${quando(p.conferido_em)}` : ''}.</p>
      </div>
    </div>
  </section>`;
}
document.addEventListener('click', e => { const a = e.target.closest('[data-abrir]'); if (a) abrirProduto(a.dataset.abrir); });

async function inicio() {
  app.innerHTML = `<div class="carregando">Lendo as prateleiras…</div>`;
  const r = await api('/api/resumo');
  // o mesmo produto (EAN) em várias lojas aparece uma vez só, na mais barata
  const unicos = l => { const v = new Set(); return [...l].sort((a, b) => a.preco - b.preco).filter(p => { const k = p.ean || p.id; if (v.has(k)) return false; v.add(k); return true; }); };
  for (const k of ['bugsLista', 'quedas', 'descontos', 'entreLojas']) { const ordem = r[k].map(p => p.ean || p.id); r[k] = unicos(r[k]).sort((a, b) => ordem.indexOf(a.ean || a.id) - ordem.indexOf(b.ean || b.id)); }
  const secao = (titulo, sub, link, textoLink, lista, vazio) => `<section class="secao">
      <div class="secao-cab"><div><h2>${titulo}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${link && lista.length ? `<a href="${link}">${textoLink}</a>` : ''}</div>
      ${lista.length ? trilho(lista) : `<div class="painel vazio">${vazio}</div>`}
    </section>`;
  const n = v => `<b>${v.toLocaleString('pt-BR')}</b>`;
  if (!r.produtos) {
    app.innerHTML = `<div class="painel vazio"><b>Lendo as lojas pela primeira vez</b>Isso leva uns 3 minutos. A página se atualiza sozinha.</div>`;
    setTimeout(() => { if (!location.hash || location.hash === '#/') inicio(); }, 15000);
    return;
  }
  app.innerHTML = `
    ${vitrine(r)}
    <p class="resumo-linha">${r.status?.rodando ? 'Lendo as lojas agora. ' : ''}Hoje: <b class="n-bug">${r.bugs.toLocaleString('pt-BR')}</b> possíveis bugs de preço, ${n(r.ofertas)} ofertas e ${n(r.comparaveis)} produtos comparados entre ${n(r.lojas)} lojas. ${n(r.cupons)} cupons ativos.</p>
    <nav class="atalhos" aria-label="Categorias">${ATALHOS.map(([nome, q]) => `<a class="atalho" href="#/catalogo?q=${encodeURIComponent(q)}">${nome}</a>`).join('')}</nav>
    ${r.favoritos ? secao('Seus favoritos', 'Os que baixaram de preço aparecem primeiro.', '#/favoritos', 'Ver todos', r.favoritosEmQueda, '') : ''}
    ${secao('Possíveis bugs de preço', 'Muito abaixo do próprio histórico ou das outras lojas. Conferidos de novo a cada 5 minutos.', '#/bugs', `Ver os ${r.bugs}`, r.bugsLista, 'Nenhum bug de preço agora. Eles costumam durar minutos; o monitor avisa assim que aparecer um.')}
    ${r.entreLojas.length ? secao('Bem mais barato que nas outras lojas', 'O mesmo código de barras custa pelo menos 20% a mais em outra loja.', '#/catalogo?comparar=1&ord=oferta', 'Ver todos', r.entreLojas, '') : ''}
    ${secao('Caíram de preço agora', 'Ficaram pelo menos 10% mais baratos desde a última leitura.', '#/catalogo?mudou=1&ord=mudou', 'Ver todos', r.quedas, 'Ainda sem quedas. Elas aparecem a partir da segunda leitura de cada loja.')}
    ${secao('Maiores descontos', 'Sobre o preço "de", já descontando as lojas que costumam inflar esse valor.', '#/catalogo?selo=ofertas&ord=desconto', 'Ver todos', r.descontos, 'Sem descontos ainda.')}`;
}

// ---------- catálogo ----------
let cacheLojas = null;
async function catalogo(params, opcoes = {}) {
  const f = Object.fromEntries(params);
  $('#busca-topo').q.value = f.q || '';
  if (!cacheLojas) cacheLojas = await api('/api/lojas');
  const titulo = opcoes.titulo || (f.q ? `Resultados para “${esc(f.q)}”` : 'Catálogo');
  const sub = opcoes.sub || 'Produtos vistos nos últimos 3 dias em todas as lojas monitoradas.';
  const rotaAtual = opcoes.rota || 'catalogo';
  app.innerHTML = `
    <div class="titulo-pag"><div><h1>${titulo}</h1><p>${sub}</p></div>
      <button class="btn mostrar-filtros" id="ver-filtros">${ICO.filtro} Filtros</button></div>
    ${f.q ? `<div class="painel aviso-busca"><p>Não achou? O monitor pode pesquisar <b>“${esc(f.q)}”</b> agora direto em todas as lojas.</p>
      <button class="btn pri" id="ao-vivo">${ICO.raio} Buscar agora nas lojas</button>
      <button class="btn" id="seguir">${ICO.seguir} Seguir esta busca</button></div>` : ''}
    <div class="catalogo">
      <aside class="painel filtros" id="filtros">
        ${opcoes.semOrdem ? '' : `<div><h3>Ordenar por</h3><select class="campo" name="ord">
          ${[['oferta', 'Melhores ofertas'], ['desconto', 'Maior desconto'], ['queda', 'Maior queda de preço'], ['mudou', 'Mudou de preço agora'], ['menor', 'Menor preço'], ['maior', 'Maior preço'], ['novos', 'Novos no monitor']]
            .map(([v, t]) => `<option value="${v}" ${f.ord === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`}
        <div><h3>Loja</h3><select class="campo" name="loja"><option value="">Todas as lojas</option>
          ${cacheLojas.filter(l => l.total).map(l => `<option value="${l.id}" ${f.loja == l.id ? 'selected' : ''}>${esc(l.nome)} (${l.total.toLocaleString('pt-BR')})</option>`).join('')}</select></div>
        <div><h3>Preço</h3><div class="faixa"><input class="campo" name="min" inputmode="decimal" placeholder="mín" value="${esc(f.min || '')}"><input class="campo" name="max" inputmode="decimal" placeholder="máx" value="${esc(f.max || '')}"></div></div>
        <div><h3>Desconto mínimo</h3><div class="chips" data-campo="off">${['', '20', '30', '50', '70'].map(v => `<button class="chip ${(f.off || '') === v ? 'on' : ''}" data-v="${v}">${v ? v + '%+' : 'Qualquer'}</button>`).join('')}</div></div>
        ${opcoes.semOrdem ? '' : `<div><h3>Mostrar</h3><div class="chips" data-campo="selo">${[['', 'Tudo'], ['ofertas', 'Só ofertas'], ['bug', 'Bugs']].map(([v, t]) => `<button class="chip ${(f.selo || '') === v ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}
          <button class="chip ${f.mudou ? 'on' : ''}" data-toggle="mudou">Caíram agora</button>
          <button class="chip ${f.comparar ? 'on' : ''}" data-toggle="comparar">Em 2+ lojas</button></div></div>`}
        <div><h3>Mesmo produto em várias lojas</h3><div class="chips" data-campo="agrupar">
          <button class="chip ${f.agrupar !== '0' ? 'on' : ''}" data-v="1">Só a mais barata</button><button class="chip ${f.agrupar === '0' ? 'on' : ''}" data-v="0">Todas</button></div></div>
        <div><h3>Categoria</h3><div class="chips" id="cats"><span class="mut peq-txt">carregando…</span></div></div>
      </aside>
      <section><div class="barra"><span class="total" id="total"></span></div><div id="lista">${esqueletos(8)}</div>
        <div class="mais"><button class="btn" id="mais" hidden>Carregar mais</button></div></section>
    </div>`;

  const atualizar = mudancas => {
    const novo = { ...f, ...mudancas };
    delete novo.pagina;
    ir(rotaAtual, novo);
  };
  $('#ver-filtros').onclick = () => $('#filtros').classList.toggle('aberto');
  app.querySelectorAll('#filtros select').forEach(s => (s.onchange = () => atualizar({ [s.name]: s.value })));
  app.querySelectorAll('#filtros .faixa input').forEach(i => (i.onchange = () => atualizar({ [i.name]: i.value.replace(',', '.') })));
  app.querySelectorAll('#filtros .chips[data-campo]').forEach(c => c.onclick = e => {
    const b = e.target.closest('.chip'); if (!b) return;
    if (b.dataset.toggle) return atualizar({ [b.dataset.toggle]: f[b.dataset.toggle] ? '' : '1' });
    atualizar({ [c.dataset.campo]: b.dataset.v });
  });
  if (f.q) {
    $('#ao-vivo').onclick = async ev => {
      const b = ev.currentTarget; b.disabled = true; b.innerHTML = `${ICO.raio} Pesquisando nas lojas…`;
      try {
        const r = await api('/api/buscar', { method: 'POST', body: { q: f.q } });
        toast(`${r.produtos} produtos encontrados em ${r.lojas} lojas`);
        carregar(0, true);
      } catch (err) { toast(err.message); }
      b.disabled = false; b.innerHTML = `${ICO.raio} Buscar agora nas lojas`;
    };
    $('#seguir').onclick = async () => {
      try { await api('/api/interesses', { method: 'POST', body: { termo: f.q } }); toast(`Seguindo “${f.q}”: aparece nos seus Favoritos`); atualizarContadores(); }
      catch (err) { toast(err.message); }
    };
  }

  api('/api/categorias' + (f.loja ? '?loja=' + f.loja : '')).then(cs => {
    $('#cats').innerHTML = [{ nome: '', n: 0 }, ...cs.slice(0, 30)].map(c =>
      `<button class="chip ${(f.categoria || '') === c.nome ? 'on' : ''}" data-v="${esc(c.nome)}">${c.nome ? esc(c.nome) + `<small>${c.n}</small>` : 'Todas'}</button>`).join('');
    $('#cats').onclick = e => { const b = e.target.closest('.chip'); if (b) atualizar({ categoria: b.dataset.v }); };
  }).catch(() => {});

  let pagina = 0;
  async function carregar(p = 0, substituir = p === 0) {
    const qs = new URLSearchParams({ agrupar: '1', ...f, ...(opcoes.fixo || {}), pagina: p, limite: 48 });
    const r = await api('/api/produtos?' + qs);
    pagina = p;
    $('#total').textContent = `${r.total.toLocaleString('pt-BR')} produtos`;
    if (substituir) $('#lista').innerHTML = r.itens.length ? grade(r.itens) : `<div class="painel vazio"><b>Nada por aqui</b>${opcoes.vazio || (f.q ? 'Use “Buscar agora nas lojas” para pesquisar este termo direto nas lojas. Lembre que o monitor mostra só produtos de tecnologia.' : 'Tente tirar alguns filtros.')}</div>`;
    else $('#lista .grade').insertAdjacentHTML('beforeend', r.itens.map(cartao).join(''));
    $('#mais').hidden = (p + 1) * r.limite >= r.total;
  }
  $('#mais').onclick = () => carregar(pagina + 1, false);
  await carregar(0);
  // busca nova sem resultados locais: pesquisa nas lojas automaticamente
  if (f.q && $('#total').textContent.startsWith('0 ') && !opcoes.rota) $('#ao-vivo').click();
}

// ---------- bugs ----------
function bugs(params) {
  return catalogo(params, {
    rota: 'bugs', semOrdem: true, fixo: { selo: 'bug', ord: 'bug' },
    titulo: 'Possíveis bugs de preço',
    sub: '<b>BUG DE PREÇO</b> (vermelho) = o preço despencou em relação ao próprio histórico, está muito abaixo do mesmo produto em outras lojas ou ficou quase zero. <b>Bug?</b> = muito abaixo do preço "de", sem confirmação ainda. Os bugs são conferidos de novo a cada 5 minutos. Corra, mas confira antes de comprar: lojas podem cancelar pedidos com erro de preço.',
    vazio: 'Nenhum bug agora. O monitor avisa assim que aparecer um.',
  });
}

// ---------- favoritos ----------
async function favoritos() {
  app.innerHTML = `<div class="titulo-pag"><div><h1>Favoritos</h1><p>Só o que você marcou: produtos com ♥ e as buscas que você segue.</p></div></div>${esqueletos(4)}`;
  const [prod, ints] = await Promise.all([api('/api/produtos?fav=1&ord=favoritado&limite=200'), api('/api/interesses')]);
  const blocos = await Promise.all(ints.map(i => api('/api/produtos?' + new URLSearchParams({ q: i.termo, ord: 'oferta', limite: 12, ...(i.preco_max ? { max: i.preco_max } : {}) }))));
  app.innerHTML = `
    <div class="titulo-pag"><div><h1>Favoritos</h1><p>Só o que você marcou: produtos com ♥ e as buscas que você segue. Quedas de preço nestes itens geram notificação.</p></div></div>
    <section class="painel seguindo">
      <h2 style="font-size:17px">Buscas que você segue</h2>
      <p class="mut peq-txt" style="margin:4px 0 0">Siga tipos de produto ("ssd 1tb", "rtx 4060", "monitor 144hz"). O monitor pesquisa esses termos em todas as lojas a cada leitura e avisa quando aparece oferta.</p>
      <div class="chips" style="margin-top:12px">${ints.map(i => `<span class="termo">${esc(i.termo)}${i.preco_max ? `, até ${R(i.preco_max)}` : ''}<button data-tirar="${i.id}" aria-label="Deixar de seguir">${ICO.x}</button></span>`).join('') || '<span class="mut peq-txt">Nenhuma ainda.</span>'}</div>
      <form class="seguir-form" id="seguir-form"><input class="campo" name="termo" placeholder="Ex.: monitor 144hz, rtx 4060, iphone 15"><input class="campo" name="max" inputmode="decimal" placeholder="Preço máx. (opcional)" style="width:190px"><button class="btn pri">${ICO.seguir} Seguir</button></form>
    </section>
    <section class="secao">
      <div class="secao-cab"><h2>Produtos favoritos <span class="cont">${prod.total}</span></h2></div>
      ${prod.itens.length ? grade(prod.itens) : '<div class="painel vazio"><b>Nenhum produto favorito</b>Toque no ♥ de qualquer produto para guardar aqui e acompanhar o preço.</div>'}
    </section>
    ${ints.map((i, n) => `<section class="secao">
      <div class="secao-cab"><h2>${esc(i.termo)} <span class="cont">${blocos[n].total}</span></h2><a href="#/catalogo?q=${encodeURIComponent(i.termo)}${i.preco_max ? '&max=' + i.preco_max : ''}">Ver os ${blocos[n].total}</a></div>
      ${blocos[n].itens.length ? trilho(blocos[n].itens) : '<div class="painel vazio">Pesquisando nas lojas… volte em instantes.</div>'}
    </section>`).join('')}`;
  $('#seguir-form').onsubmit = async e => {
    e.preventDefault();
    const termo = e.target.termo.value.trim();
    try {
      await api('/api/interesses', { method: 'POST', body: { termo, precoMax: e.target.max.value.replace(/\./g, '').replace(',', '.') } });
      toast(`Seguindo “${termo}”. Pesquisando nas lojas…`);
      favoritos(); setTimeout(() => location.hash.startsWith('#/favoritos') && favoritos(), 12000);
    } catch (err) { toast(err.message); }
  };
  app.querySelectorAll('[data-tirar]').forEach(b => (b.onclick = async () => { await api('/api/interesses/' + b.dataset.tirar, { method: 'DELETE' }); favoritos(); atualizarContadores(); }));
}

// ---------- alertas ----------
async function alertas(params) {
  const soFav = params.get('fav') === '1';
  const [lista, rd] = await Promise.all([api('/api/alertas?limite=200' + (soFav ? '&fav=1' : '')), api('/api/resumo-diario')]);
  const ROT = { bug: 'Bug de preço', alvo: 'Preço alvo', desconto: 'Desconto', queda: 'Queda de preço', minimo: 'Menor preço' };
  const SEL = { bug: 'bug', alvo: 'alvo', queda: 'queda', minimo: 'minimo', desconto: '' };
  const blocoResumo = (titulo, ps) => ps.length ? `<div class="resumo-bloco"><h3>${titulo}</h3>${trilho(ps)}</div>` : '';
  const segue = rd.interesses.filter(i => i.melhor);
  const temResumo = rd.bugs.length + rd.favoritos.length + segue.length + rd.entreLojas.length + rd.quedas.length;
  app.innerHTML = `
    <section class="painel resumo-dia">
      <div class="secao-cab"><div><h2>Resumo das últimas 24 horas</h2>
        <p class="mut peq-txt" style="margin:2px 0 0">${rd.ativo ? `Enviado todo dia às ${rd.hora}h pelas notificações configuradas${rd.enviadoEm ? `. Último envio em ${new Date(rd.enviadoEm + 'T12:00').toLocaleDateString('pt-BR')}` : ''}.` : 'Envio diário desligado em config.json.'}</p></div>
        <button class="btn peq" id="enviar-resumo">Enviar agora</button></div>
      ${temResumo ? `${blocoResumo('Possíveis bugs de preço', rd.bugs)}${blocoResumo('Seus favoritos que baixaram', rd.favoritos)}
        ${blocoResumo('Buscas que você segue: a melhor oferta de cada', segue.map(i => i.melhor))}
        ${blocoResumo('Bem mais barato que nas outras lojas', rd.entreLojas)}${blocoResumo('Maiores quedas', rd.quedas)}`
      : '<p class="mut">Nada de especial nas últimas 24 horas ainda.</p>'}
    </section>
    <div class="titulo-pag"><div><h1>Alertas</h1><p>Mudanças de preço que valeram um aviso, das mais recentes para as mais antigas.</p></div>
      <div class="chips"><a class="chip ${soFav ? '' : 'on'}" href="#/alertas">Todos</a><a class="chip ${soFav ? 'on' : ''}" href="#/alertas?fav=1">Só favoritos</a></div></div>
    <div class="painel alertas">${lista.length ? lista.map(a => {
      produtosVistos.has(a.produto_id) || produtosVistos.set(a.produto_id, { id: a.produto_id, nome: a.nome, loja: a.loja, imagem: a.imagem, preco: a.preco, preco_de: a.preco_de, url: a.url });
      return `<div class="alerta card" data-id="${esc(a.produto_id)}" style="border-radius:0;border-width:1px 0 0;flex-direction:row;transform:none;box-shadow:none">
        <div class="mini">${a.imagem ? `<img src="${esc(a.imagem)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</div>
        <div style="min-width:0"><span class="selo ${SEL[a.tipo]} ${a.tipo === 'bug' && a.nivel < 3 ? 'bug2' : ''}">${a.tipo === 'bug' && a.nivel < 3 ? 'Bug?' : ROT[a.tipo] || a.tipo}</span>
          <div class="tit" style="margin-top:4px">${esc(a.nome)}</div><div class="motivo">${esc(a.loja)}: ${esc(a.motivo)}</div></div>
        <div class="lado">${a.preco_de ? `<span class="de">${R(a.preco_de)}</span>` : ''}${etiqueta(a.preco, 'pequena', a.tipo === 'bug' && a.nivel >= 3)}<div class="quando">${quando(a.t)}</div></div>
      </div>`;
    }).join('') : '<div class="vazio"><b>Sem alertas ainda</b>Eles aparecem quando um preço muda de um jeito que vale a pena.</div>'}</div>`;
  const enviar = $('#enviar-resumo');
  enviar.onclick = async () => {
    enviar.disabled = true;
    try { await api('/api/resumo-diario/enviar', { method: 'POST' }); toast('Resumo enviado para as notificações configuradas'); }
    catch (err) { toast(err.message); }
    enviar.disabled = false;
  };
}

// ---------- lojas ----------
const PLAT = { vtex: 'Catálogo VTEX', 'vtex-legado': 'Catálogo VTEX', shopify: 'Catálogo Shopify', pagina: 'Páginas', avulso: 'Produtos avulsos' };
async function lojas() {
  const ls = await api('/api/lojas');
  cacheLojas = ls;
  const cartaoLoja = l => `<div class="painel loja ${l.ativo ? '' : 'off'}">
      <div class="loja-top"><div class="loja-ico"><img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(l.dominio)}&sz=64" alt="" loading="lazy" referrerpolicy="no-referrer"></div>
        <div style="min-width:0"><h3>${esc(l.nome)}</h3><div class="dom">${esc(l.dominio)}</div></div>
        <button class="interruptor ${l.ativo ? 'on' : ''}" data-ativo="${l.id}" aria-label="Ativar/pausar"></button></div>
      <div class="linha"><span class="plat">${PLAT[l.plataforma] || l.plataforma}</span><span>${l.total.toLocaleString('pt-BR')} produtos</span>${l.n_cupons ? `<span>${l.n_cupons} cupons</span>` : ''}
        <span>${l.coletando ? '<b style="color:var(--queda)">lendo agora…</b>' : 'lida ' + quando(l.coletado_em)}</span>
        ${l.inflacao > 0.05 ? '<span title="Muitos produtos com preço &quot;de&quot; irreal: o de/por desta loja não conta como bug">"de" inflado</span>' : ''}</div>
      ${l.erro ? `<div class="erro">${esc(l.erro)}</div>` : ''}
      ${l.ativo ? `<div class="chips" title="Especializada: entra tudo que não for claramente outra coisa. Mista: só o que é claramente tecnologia, buscado por termos como notebook e smart tv.">
        <button class="chip ${l.foco === 'tecnologia' ? 'on' : ''}" data-foco="tecnologia" data-id="${l.id}">Só tecnologia</button>
        <button class="chip ${l.foco !== 'tecnologia' ? 'on' : ''}" data-foco="misto" data-id="${l.id}">Vende de tudo</button></div>` : ''}
      <div class="acoes"><a class="btn peq" href="#/catalogo?loja=${l.id}">Ver produtos</a><button class="btn peq" data-ler="${l.id}">${ICO.recarregar} Ler agora</button>
        <button class="btn peq" data-apagar="${l.id}" style="margin-left:auto" title="Remover loja">${ICO.x}</button></div>
    </div>`;
  const ativas = ls.filter(l => l.ativo), pausadas = ls.filter(l => !l.ativo);
  app.innerHTML = `<div class="titulo-pag"><div><h1>Lojas</h1><p>De onde vem o catálogo de tecnologia. Cada loja é relida a cada hora.</p></div>
      <button class="btn" id="tudo">${ICO.recarregar} Ler todas agora</button></div>
    <section class="painel add-loja">
      <h2 style="font-size:17px">Adicionar loja, página ou produto</h2>
      <p class="mut peq-txt" style="margin:4px 0 0">Cole o endereço de uma loja (ex.: <b>www.waz.com.br</b>): se ela tiver catálogo público, os produtos de tecnologia dela entram. Senão, cole o link de uma página de categoria/ofertas, ou de um produto específico.</p>
      <form id="add-loja"><input class="campo" name="entrada" placeholder="www.loja.com.br ou https://loja.com.br/categoria/..." required><input class="campo" name="nome" placeholder="Nome (opcional)" style="flex:0 1 200px;min-width:150px"><button class="btn pri">Adicionar</button></form>
    </section>
    <div class="lojas">${ativas.map(cartaoLoja).join('')}</div>
    ${pausadas.length ? `<div class="secao-cab" style="margin-top:30px"><h2>Pausadas <span class="cont">${pausadas.length}</span></h2></div>
      <p class="mut peq-txt" style="margin:-6px 0 12px">Lojas sem foco em tecnologia (moda, farmácia, pet, casa...). Ligue de novo se quiser: só os produtos de tecnologia delas entram.</p>
      <div class="lojas">${pausadas.map(cartaoLoja).join('')}</div>` : ''}`;
  app.querySelectorAll('[data-foco]').forEach(b => (b.onclick = async () => {
    await api('/api/lojas/' + b.dataset.id, { method: 'PATCH', body: { foco: b.dataset.foco } });
    toast('Atualizado: a loja será relida na próxima rodada'); lojas();
  }));

  $('#add-loja').onsubmit = async e => {
    e.preventDefault();
    const b = e.target.querySelector('button'); b.disabled = true; b.textContent = 'Analisando a loja…';
    try {
      const l = await api('/api/lojas', { method: 'POST', body: { entrada: e.target.entrada.value, nome: e.target.nome.value } });
      toast(`${l.nome} adicionada (${PLAT[l.plataforma]}). Lendo os produtos…`);
      lojas();
    } catch (err) { toast(err.message); b.disabled = false; b.textContent = 'Adicionar'; }
  };
  $('#tudo').onclick = async () => { await api('/api/coletar', { method: 'POST' }); toast('Lendo todas as lojas…'); setTimeout(lojas, 1500); };
  app.querySelectorAll('[data-ativo]').forEach(b => (b.onclick = async () => { await api('/api/lojas/' + b.dataset.ativo, { method: 'PATCH', body: { ativo: !b.classList.contains('on') } }); lojas(); }));
  app.querySelectorAll('[data-ler]').forEach(b => (b.onclick = async () => { await api(`/api/lojas/${b.dataset.ler}/coletar`, { method: 'POST' }); toast('Lendo a loja…'); setTimeout(lojas, 1500); }));
  app.querySelectorAll('[data-apagar]').forEach(b => (b.onclick = async () => {
    if (!confirm('Remover esta loja e todo o histórico de preços dela?')) return;
    await api('/api/lojas/' + b.dataset.apagar, { method: 'DELETE' }); lojas();
  }));
}

// ---------- contadores e status ----------
async function atualizarContadores() {
  try {
    const r = await api('/api/resumo');
    $('#c-bugs').textContent = r.bugs || '';
    $('#c-fav').textContent = (r.favoritos + r.interesses.length) || '';
    const st = $('#status');
    const lendo = r.status.rodando || r.status.buscandoAoVivo;
    st.hidden = !lendo;
    $('#carga').hidden = !lendo;
    st.textContent = r.status.buscandoAoVivo ? `pesquisando “${r.status.buscandoAoVivo}”…` : 'lendo lojas…';
  } catch {}
}
setInterval(atualizarContadores, 10000);
atualizarContadores();
rota();
