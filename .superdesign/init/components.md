# Components

Vanilla HTML/CSS/JS (no framework, no component library). Components are JS functions in `site/app.js` that return HTML strings; styles in `site/estilo.css`. Helpers: `esc()` escapes HTML, `R(v)` formats BRL ("R$ 1.299,90"), `pct(v)` → "42%".

## PriceTag
- File: `site/app.js`
- etiqueta de preço do varejo: "R$" pequeno, inteiro grande, centavos sobrescritos sublinhados. Tamanhos pequena/media/grande; vermelha quando bug confirmado.

### `partes` (site/app.js:9)
```js
const partes = v => { const [i, c] = v.toFixed(2).split('.'); return [Number(i).toLocaleString('pt-BR'), c]; };
```

### `etiqueta` (site/app.js:10)
```js
const etiqueta = (v, tam = 'media', bug = false) => {
  if (v == null) return '';
  const [i, c] = partes(v);
  return `<span class="etq ${tam} ${bug ? 'bug' : ''}" aria-label="${R(v)}"><span class="rs">R$</span><span class="int">${i}</span><span class="cts">,${c}</span></span>`;
};
```

## ProductOnShelf
- File: `site/app.js`
- produto solto na prateleira: foto, selos, coração de favorito, loja, nome (3 linhas), preço "de" riscado, etiqueta, Pix, comparação entre lojas, bug ativo há X.

### `selos` (site/app.js:61)
```js
function selos(p) {
  const s = [];
  if (p.selo === 'bug') s.push(`<span class="selo ${p.selo_nivel >= 3 ? 'bug' : 'bug2'}">${p.selo_nivel >= 3 ? 'BUG DE PREÇO' : 'Bug?'}</span>`);
  if (p.selo === 'alvo') s.push('<span class="selo alvo">Preço alvo</span>');
  if (p.selo === 'minimo') s.push('<span class="selo minimo">Menor preço</span>');
  // o desconto sobre o "de" já aparece no preço riscado; o selo fica só para queda real no histórico
  if (p.queda >= 0.1) s.push(`<span class="selo queda">▼ ${pct(p.queda)}</span>`);
  return s.join('');
}
```

### `variacao` (site/app.js:71)
```js
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
```

### `cartao` (site/app.js:84)
```js
function cartao(p, i = 0) {
  produtosVistos.set(p.id, p);
  const bugConfirmado = p.selo === 'bug' && p.selo_nivel >= 3 && p.disponivel !== 0;
  return `<article class="card" data-id="${esc(p.id)}">
    <div class="foto">${p.imagem ? `<img src="${esc(p.imagem)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="sem-foto">sem foto</span>'}
      <div class="selos">${selos(p)}</div>
      <button class="coracao ${p.favorito ? 'on' : ''}" data-fav="${esc(p.id)}" aria-label="Favoritar">${ICO.coracao}</button>
    </div>
    <div class="info">
      <span class="loja-chip">${esc(p.loja)}${p.n_cupons ? ' <span class="tag-cupom" title="Esta loja tem cupons ativos">tem cupom</span>' : ''}</span>
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
  </article>`;
}
```

### `entreLojas` (site/app.js:108)
```js
function entreLojas(p) {
  if (!(p.n_lojas >= 2)) return '';
  if (p.menor_outras == null || p.preco <= p.menor_outras) {
    const dif = p.menor_outras ? 1 - p.preco / p.menor_outras : 0;
    return `<span class="lojas-tag melhor">Mais barato de ${p.n_lojas} lojas${dif >= 0.05 ? `, ${pct(dif)} abaixo` : ''}</span>`;
  }
  return `<span class="lojas-tag">Em ${p.n_lojas} lojas, a partir de ${R(p.menor_outras)}</span>`;
}
```

### `duracao` (site/app.js:117)
```js
const duracao = t => {
  const m = Math.max(1, Math.round((Date.now() - t) / 60000));
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${Math.round(m / 1440)} dias`;
};
```

## Shelf
- File: `site/app.js`
- prateleira horizontal rolável com setas e borda grossa de gôndola embaixo; Grade = mesma ideia em grid.

### `grade` (site/app.js:122)
```js
const grade = ps => `<div class="grade">${ps.map((p, i) => cartao(p, i)).join('')}</div>`;
```

### `trilho` (site/app.js:123)
```js
const trilho = ps => `<div class="trilho-caixa">
    <button class="seta esq" aria-label="Anteriores"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
    <div class="trilho">${ps.map((p, i) => cartao(p, i)).join('')}</div>
```

## ProductSheet
- File: `site/app.js`
- conteúdo do <dialog> do produto: foto, detalhes, motivo do selo, estatísticas, gráfico, ações, comparação entre lojas, cupons, semelhantes.

### `fichaProduto` (site/app.js:226)
```js
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
```

### `comparacao` (site/app.js:265)
```js
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
```

### `grafico` (site/app.js:285)
```js
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
      <defs><linearGradient id="gr" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffd200" stop-opacity=".55"/><stop offset="1" stop-color="#ffd200" stop-opacity=".05"/></linearGradient></defs>
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
```

## Ícones SVG inline (traço 2px, sem preenchimento).
- File: `site/app.js`
- Ícones SVG inline (traço 2px, sem preenchimento).

### `ICO` (site/app.js:48)
```js
const ICO = {
  coracao: '<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z"/></svg>',
  externo: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>',
  raio: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  recarregar: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5"/></svg>',
  filtro: '<svg viewBox="0 0 24 24"><path d="M3 5h18M6 12h12M10 19h4"/></svg>',
  seguir: '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0"/></svg>',
};
```

## Shared CSS for these components
```css
/* ================= etiqueta de preço (o elemento da página) =================
   "R$" pequeno, inteiro grande, centavos sobrescritos sublinhados, como na gôndola */
.etq { display: inline-flex; align-items: flex-start; gap: 2px; background: var(--etiqueta); color: var(--etiqueta-tinta); font-family: var(--cond); font-stretch: 68%; font-weight: 800;
  line-height: .9; padding: 6px 10px 5px 8px; border-radius: 2px; font-variant-numeric: tabular-nums lining-nums; white-space: nowrap; position: relative; }
.etq .rs { font-size: .36em; margin-top: .22em; margin-right: 2px; font-weight: 700; }
.etq .int { font-size: 1em; letter-spacing: -.01em; }
.etq .cts { font-size: .46em; margin-top: .08em; text-decoration: underline; text-decoration-thickness: .08em; text-underline-offset: .12em; }
.etq.bug { background: var(--encarte); color: #fff; }
.etq.pequena { font-size: 24px; }
.etq.media { font-size: 34px; }
.etq.grande { font-size: 88px; padding: 10px 18px 8px 14px; border-radius: 3px; }
/* preço "de": riscado em vermelho, como no encarte */
.de { color: var(--grafite); font-size: 14px; text-decoration: line-through; text-decoration-color: var(--encarte); text-decoration-thickness: 2px; font-variant-numeric: tabular-nums; }
.pix { font-size: 13px; color: var(--queda); font-weight: 600; }
.var { font-size: 13px; font-weight: 600; }
.var.cai { color: var(--queda); }
.var.sobe { color: var(--encarte); }
```

```css
/* ---------- prateleiras ---------- */
.secao { margin-bottom: 48px; }
.secao-cab { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px; gap: 16px; }
.secao-cab h2 { font-size: 34px; }
.secao-cab .sub { color: var(--grafite); font-size: 15px; margin-top: 4px; }
.secao-cab a { font-weight: 600; font-size: 15px; white-space: nowrap; text-decoration: underline; text-underline-offset: 3px; }
.secao-cab a:hover { text-decoration-color: var(--etiqueta); text-decoration-thickness: 3px; }
.trilho-caixa { position: relative; }
.trilho { display: grid; grid-auto-flow: column; grid-auto-columns: 220px; gap: 0; overflow-x: auto; scrollbar-width: none; scroll-snap-type: x proximity; border-bottom: var(--borda-gondola); }
.trilho > * { scroll-snap-align: start; }
.seta { position: absolute; top: 34%; z-index: 3; width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid var(--tinta); background: var(--papel); display: grid; place-items: center; cursor: pointer; color: var(--tinta); }
.seta svg { width: 18px; }
.seta:hover { background: var(--etiqueta); color: #16181d; }
.seta.esq { left: -12px; } .seta.dir { right: -12px; }
.seta[disabled] { display: none; }

/* ---------- produto na prateleira ---------- */
.grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); row-gap: 40px; }
.grade .card { border-bottom: var(--borda-gondola); }
.card { position: relative; display: flex; flex-direction: column; cursor: pointer; padding: 0 14px; min-width: 0; }
.card + .card { box-shadow: inset 1px 0 0 var(--linha); }
.card .foto { aspect-ratio: 1; display: grid; place-items: center; padding: 14px 6px 10px; position: relative; }
.card .foto img { max-width: 100%; max-height: 100%; object-fit: contain; background: var(--foto); mix-blend-mode: multiply; border-radius: 3px; }
:root[data-tema="escuro"] .card .foto img { mix-blend-mode: normal; }
@media (prefers-color-scheme: dark) { :root:not([data-tema="claro"]) .card .foto img, :root:not([data-tema="claro"]) .vitrine .palco img { mix-blend-mode: normal; } }
.card .sem-foto { color: var(--cinza); font-size: 13px; }
.card .info { display: flex; flex-direction: column; gap: 3px; padding: 4px 0 14px; flex: 1; }
.card .nome { font-size: 14.5px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; min-height: 4.05em; }
.card:hover .nome { text-decoration: underline; text-decoration-color: var(--etiqueta); text-decoration-thickness: 3px; text-underline-offset: 2px; }
.loja-chip { font-size: 13px; color: var(--grafite); display: flex; align-items: center; gap: 6px; }
.precos { margin-top: auto; padding-top: 8px; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
.precos .etq { margin-top: 2px; }
/* sinais do produto: pequenos, em texto, encostados no topo da foto */
.selos { position: absolute; top: 12px; left: 0; display: flex; flex-direction: column; gap: 4px; align-items: flex-start; z-index: 1; }
.selo { font-size: 12.5px; font-weight: 700; padding: 2px 7px; border-radius: 2px; background: var(--tinta); color: var(--papel); font-variant-numeric: tabular-nums; }
.selo.bug { background: var(--encarte); color: #fff; }
.selo.bug2 { background: var(--papel); color: var(--encarte); box-shadow: inset 0 0 0 1.5px var(--encarte); }
.selo.queda { background: var(--queda); color: #fff; }
.selo.alvo { background: var(--alvo); color: #fff; }
.selo.minimo { background: var(--tinta); }
.coracao { position: absolute; top: 10px; right: 0; width: 34px; height: 34px; border-radius: 50%; border: 0; background: transparent; display: grid; place-items: center; cursor: pointer; color: var(--cinza); z-index: 3; }
.coracao:hover { color: var(--encarte); }
.coracao svg { width: 20px; }
.coracao.on { color: var(--encarte); }
.coracao.on svg { fill: var(--encarte); }
.coracao.pop svg { animation: pop .4s cubic-bezier(.3, 1.6, .5, 1); }
@keyframes pop { 40% { transform: scale(1.35); } }
.lojas-tag { font-size: 13px; color: var(--grafite); }
.lojas-tag.melhor { color: var(--queda); font-weight: 600; }
.tag-cupom { font-size: 12px; color: var(--alvo); font-weight: 600; }
.ativo-ha { font-size: 13px; font-weight: 600; color: var(--encarte); }
```

```css
/* ---------- ficha do produto ---------- */
.modal { border: 0; padding: 0; border-radius: 12px; width: min(1000px, calc(100vw - 32px)); max-height: calc(100vh - 40px); background: var(--papel); color: var(--tinta); box-shadow: 0 30px 80px rgba(0,0,0,.35); }
.modal[open] { animation: abrir .22s ease-out; }
@keyframes abrir { from { opacity: 0; transform: translateY(10px); } }
.modal::backdrop { background: rgba(10, 11, 14, .55); }
.fechar { position: absolute; top: 14px; right: 14px; z-index: 4; }
.prod { display: grid; grid-template-columns: 380px minmax(0, 1fr); }
.prod .foto { display: grid; place-items: center; padding: 30px; min-height: 380px; border-right: 1px solid var(--linha); }
.prod .foto img { max-width: 100%; max-height: 400px; object-fit: contain; background: var(--foto); mix-blend-mode: multiply; }
:root[data-tema="escuro"] .prod .foto img { mix-blend-mode: normal; }
.prod .det { padding: 28px 30px; display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.prod h2 { font-size: 34px; padding-right: 44px; }
.prod .det .etq { font-size: 56px; }
.motivo-box { padding: 12px 14px; font-size: 15px; background: var(--queda-fundo); color: var(--queda); border-left: 5px solid currentColor; }
.motivo-box.bug { background: var(--encarte-fundo); color: var(--encarte); }
.motivo-box.queda { background: var(--queda-fundo); color: var(--queda); }
.motivo-box.alvo { background: var(--alvo-fundo); color: var(--alvo); }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--linha); border-bottom: 1px solid var(--linha); }
.stats div { padding: 9px 0; }
.stats div + div { padding-left: 14px; border-left: 1px solid var(--linha); }
.stats span { display: block; color: var(--grafite); font-size: 13px; }
.stats b { font-family: var(--cond); font-stretch: 72%; font-size: 24px; font-variant-numeric: tabular-nums; }
.grafico { position: relative; }
.grafico svg { width: 100%; height: 170px; display: block; overflow: visible; }
.grafico .dica { position: absolute; pointer-events: none; background: var(--etiqueta); color: #16181d; font-weight: 700; font-size: 13px; padding: 4px 8px; border-radius: 2px; white-space: nowrap; transform: translate(-50%, -120%); }
.prod-acoes { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.alvo-form { display: flex; gap: 6px; align-items: center; }
.alvo-form .campo { width: 150px; }
.semelhantes { padding: 8px 30px 30px; }
.semelhantes h3 { font-size: 28px; margin-bottom: 12px; }
.semelhantes .secao-cab h3 { margin: 0; }
.semelhantes .trilho { grid-auto-columns: 190px; }
.bug-status { margin-top: 6px; font-size: 14px; }
.comparar { display: flex; flex-direction: column; border-top: 1px solid var(--linha); }
.cmp-linha { display: grid; grid-template-columns: 160px minmax(0, 1fr) auto; gap: 14px; padding: 10px 0; border-bottom: 1px solid var(--linha); align-items: center; }
.cmp-linha:hover .cmp-loja { text-decoration: underline; text-decoration-color: var(--etiqueta); text-decoration-thickness: 3px; }
.cmp-linha.atual .cmp-loja::after { content: " (esta)"; font-weight: 400; color: var(--grafite); }
.cmp-linha.off { opacity: .5; }
.cmp-loja { font-weight: 700; font-size: 15px; }
.cmp-loja small { display: none; }
.cmp-nome { color: var(--grafite); font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmp-preco { text-align: right; white-space: nowrap; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.cmp-preco small { color: var(--queda); font-size: 13px; font-weight: 600; }
.cmp-preco .lojas-tag { display: none; }
.cupons { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; margin-bottom: 8px; }
.cupom { display: flex; gap: 10px; align-items: center; justify-content: space-between; border: 2px dashed var(--tinta); border-radius: 4px; padding: 10px 12px; }
.cupom > div { min-width: 0; display: flex; flex-direction: column; }
.cupom b { font-family: var(--cond); font-stretch: 72%; font-size: 22px; }
.cupom span { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cupom small { color: var(--grafite); font-size: 12.5px; }
/* o código do cupom é o único texto que é literalmente código */
.cupom .btn { font-family: ui-monospace, Consolas, monospace; letter-spacing: .04em; }
.resumo-dia { padding: 24px; margin-bottom: 40px; }
.resumo-dia h2 { font-size: 34px; }
.resumo-bloco { margin-top: 22px; }
.resumo-bloco h3 { font-family: var(--texto); font-stretch: 100%; font-size: 16px; font-weight: 700; margin-bottom: 10px; letter-spacing: 0; }
.resumo-bloco .trilho { grid-auto-columns: 190px; }
.resumo-dia .trilho { border-bottom-width: 4px; }

.toast { position: fixed; bottom: 24px; left: 24px; background: var(--tinta); color: var(--papel); padding: 12px 18px; border-radius: 4px; font-size: 15px; font-weight: 500; z-index: 70; max-width: calc(100vw - 48px); border-left: 6px solid var(--etiqueta); animation: toast .2s ease-out; }
@keyframes toast { from { opacity: 0; transform: translateY(8px); } }
.carregando { padding: 40px 0; color: var(--cinza); }
.esqueleto { background: var(--gondola); aspect-ratio: .66; border-bottom: var(--borda-gondola); }
```
