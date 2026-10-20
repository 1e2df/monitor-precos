# Theme

## Part 1 — Token summary

Concept: Brazilian retail shelf ("gôndola") and price tag ("etiqueta de preço"). One loud element — the yellow price tag; everything else quiet black/white/grey. No cards with shadows; products sit loose on thick shelf borders.

**Colors (light, `:root`)**
- --papel #ffffff (page background) · --gondola #edeef1 (panels) · --gondola2 #e2e4e9
- --tinta #16181d (text, buttons, shelf border) · --grafite #5e636e (secondary text) · --cinza #8d929c (tertiary) · --linha #dcdfe5 (hairlines)
- --etiqueta #ffd200 (price tag yellow; selection; focus ring) · --etiqueta-tinta #16181d
- --encarte #e10600 (bugs, strikethrough of old price) · --encarte-fundo #fdecea
- --queda #0b7a44 (price drops, Pix price) · --queda-fundo #e5f4ec · --alvo #9a5b00 · --alvo-fundo #fff3d6
- --foto #ffffff (product photo stage)

**Colors (dark, `[data-tema="escuro"]` / prefers-color-scheme dark)**
- --papel #14151a · --gondola #1d1f26 · --gondola2 #262932 · --tinta #f1f1ec · --grafite #a8acb6 · --cinza #7a7f8a · --linha #2d3039
- --encarte #ff3b30 · --encarte-fundo #3a1514 · --queda #4fd18b · --queda-fundo #12291d · --alvo #ffc24a · --alvo-fundo #33270c · --foto #f4f4f1 · tag stays #ffd200

**Type** — one family, Archivo (Google Fonts, variable wdth 62–125, wght 400–800):
- Condensed display (font-stretch 68–72%, weight 800, line-height 1.02): prices, headings, category links, wordmark
- Body (font-stretch 100%, 400/500/600/700), base 16px / 1.5
- Scale: 13 · 14 · 15 · 16 · 17 · 20 · 24 · 26 · 30 · 34 · 56 · 88 (hero price tag)
- Price tag anatomy: "R$" at .36em raised, integer 1em, cents .46em superscript underlined

**Radius** (hierarchy): price tag 2–3px · chips 4px · inputs/buttons 6px · modal 12px · shelves/panels 0
**Borders**: shelf edge 6px solid var(--tinta); hairlines 1px var(--linha); search 2px var(--tinta)
**Shadows**: none on content; modal only (0 30px 80px rgba(0,0,0,.35))
**Motion**: one page-load moment (hero tag swings in and its price counts down from old to new). Otherwise only responses to actions (heart pop, modal open, toast). Respects prefers-reduced-motion.
**Breakpoints**: 960px (single column, filters collapse), 640px (phone: 2-column grid, header wraps)
**Copy rules**: sentence case, no all-caps labels, no " · " meta strings, no "→" on links.

## Part 2 — Raw source

### `site/estilo.css` (full)
```css
/* Monitor de Preços — prateleira e etiqueta de preço do varejo
   Uma família (Archivo) em duas larguras: condensada para preço e título, normal para texto.
   A etiqueta amarela é o único elemento ousado; o resto fica quieto. */
:root {
  --papel: #ffffff; --gondola: #edeef1; --gondola2: #e2e4e9; --tinta: #16181d; --grafite: #5e636e; --cinza: #8d929c; --linha: #dcdfe5;
  --etiqueta: #ffd200; --etiqueta-tinta: #16181d; --encarte: #e10600; --encarte-fundo: #fdecea;
  --queda: #0b7a44; --queda-fundo: #e5f4ec; --alvo: #9a5b00; --alvo-fundo: #fff3d6;
  --foto: #ffffff;
  --cond: "Archivo", "Arial Narrow", system-ui, sans-serif;
  --texto: "Archivo", "Segoe UI", system-ui, sans-serif;
  --borda-gondola: 6px solid var(--tinta);
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-tema="claro"]) {
    --papel: #14151a; --gondola: #1d1f26; --gondola2: #262932; --tinta: #f1f1ec; --grafite: #a8acb6; --cinza: #7a7f8a; --linha: #2d3039;
    --encarte: #ff3b30; --encarte-fundo: #3a1514; --queda: #4fd18b; --queda-fundo: #12291d; --alvo: #ffc24a; --alvo-fundo: #33270c;
    --foto: #f4f4f1; color-scheme: dark;
  }
}
:root[data-tema="escuro"] {
  --papel: #14151a; --gondola: #1d1f26; --gondola2: #262932; --tinta: #f1f1ec; --grafite: #a8acb6; --cinza: #7a7f8a; --linha: #2d3039;
  --encarte: #ff3b30; --encarte-fundo: #3a1514; --queda: #4fd18b; --queda-fundo: #12291d; --alvo: #ffc24a; --alvo-fundo: #33270c;
  --foto: #f4f4f1; color-scheme: dark;
}

* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--papel); color: var(--tinta); font: 400 16px/1.5 var(--texto); font-stretch: 100%; -webkit-font-smoothing: antialiased; }
a { color: inherit; text-decoration: none; }
button, input, select { font: inherit; color: inherit; }
svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
h1, h2, h3 { margin: 0; font-family: var(--cond); font-stretch: 72%; font-weight: 800; letter-spacing: -.005em; line-height: 1.02; }
[hidden] { display: none !important; }
:focus-visible { outline: 3px solid var(--etiqueta); outline-offset: 2px; box-shadow: 0 0 0 5px var(--tinta); border-radius: 4px; }
::selection { background: var(--etiqueta); color: #16181d; }

/* barra fina enquanto as lojas são lidas: é informação, não enfeite */
.carga { position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 60; background: var(--etiqueta); transform-origin: left; animation: carga 2.4s ease-in-out infinite; }
@keyframes carga { 0% { transform: scaleX(0); } 60% { transform: scaleX(1); opacity: 1; } 100% { transform: scaleX(1); opacity: 0; } }

/* ---------- topo ---------- */
.topo { position: sticky; top: 0; z-index: 20; background: var(--papel); border-bottom: 1px solid var(--linha); }
.topo-in { max-width: 1320px; margin: 0 auto; display: flex; align-items: center; gap: 24px; padding: 14px 24px 6px; }
.marca { display: flex; align-items: center; gap: 10px; white-space: nowrap; font-family: var(--cond); font-stretch: 72%; font-weight: 800; font-size: 24px; letter-spacing: -.01em; }
/* o logo é uma etiqueta de preço com o furo do barbante */
.logo { width: 30px; height: 22px; background: var(--etiqueta); border-radius: 2px 7px 7px 2px; position: relative; display: block; box-shadow: inset 0 0 0 1.5px #16181d; }
.logo::before { content: ""; position: absolute; right: 6px; top: 50%; width: 5px; height: 5px; margin-top: -2.5px; border-radius: 50%; background: var(--papel); box-shadow: inset 0 0 0 1.5px #16181d; }
.logo svg { display: none; }
.busca { flex: 1; max-width: 640px; position: relative; }
.busca .ico { position: absolute; left: 14px; top: 50%; width: 18px; transform: translateY(-50%); color: var(--grafite); }
.busca input { width: 100%; height: 44px; border-radius: 6px; border: 2px solid var(--tinta); background: var(--papel); padding: 0 16px 0 42px; outline: none; font-size: 16px; }
.busca input::placeholder { color: var(--cinza); }
.busca input:focus { box-shadow: 0 0 0 4px var(--etiqueta); }
.topo-acoes { display: flex; align-items: center; gap: 10px; margin-left: auto; }
.status { font-size: 13px; color: var(--grafite); white-space: nowrap; }
.abas { max-width: 1320px; margin: 0 auto; display: flex; gap: 4px; padding: 0 16px; overflow-x: auto; scrollbar-width: none; }
.abas::-webkit-scrollbar { display: none; }
.abas a { padding: 8px 10px 10px; color: var(--grafite); font-size: 15px; font-weight: 500; white-space: nowrap; display: flex; align-items: center; gap: 6px; border-bottom: 3px solid transparent; }
.abas a:hover { color: var(--tinta); }
.abas a.on { color: var(--tinta); font-weight: 700; border-color: var(--tinta); }
.cont { font-size: 12px; font-weight: 700; min-width: 20px; text-align: center; padding: 0 6px; border-radius: 2px; background: var(--gondola); color: var(--tinta); line-height: 20px; }
.cont:empty { display: none; }
a[data-v="bugs"] .cont { background: var(--encarte); color: #fff; }

/* ---------- geral ---------- */
main { max-width: 1320px; margin: 0 auto; padding: 28px 24px 80px; }
.icone { width: 40px; height: 40px; border-radius: 6px; border: 1px solid var(--linha); background: var(--papel); display: grid; place-items: center; cursor: pointer; color: var(--grafite); flex-shrink: 0; }
.icone:hover { color: var(--tinta); border-color: var(--tinta); }
.icone svg { width: 18px; }
.btn { height: 42px; padding: 0 16px; border-radius: 6px; border: 1.5px solid var(--tinta); background: var(--papel); cursor: pointer; font-weight: 600; font-size: 15px; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.btn:hover { background: var(--gondola); }
.btn:active { transform: translateY(1px); }
.btn.pri { background: var(--tinta); color: var(--papel); }
.btn.pri:hover { background: var(--tinta); box-shadow: 0 0 0 3px var(--etiqueta); }
.btn.peq { height: 34px; padding: 0 12px; font-size: 14px; }
.btn svg { width: 16px; }
.btn:disabled { opacity: .55; cursor: default; }
.btn.on { border-color: var(--encarte); color: var(--encarte); }
.btn.on svg { fill: var(--encarte); }
.campo { height: 42px; border-radius: 6px; border: 1.5px solid var(--linha); background: var(--papel); padding: 0 12px; outline: none; min-width: 0; font-size: 15px; }
.campo:focus { border-color: var(--tinta); box-shadow: 0 0 0 3px var(--etiqueta); }
.painel { background: var(--gondola); border-radius: 0; }
.vazio { color: var(--grafite); padding: 36px 24px; max-width: 62ch; }
.vazio b { display: block; color: var(--tinta); font-family: var(--cond); font-stretch: 72%; font-weight: 800; font-size: 26px; margin-bottom: 6px; }
.mut { color: var(--grafite); }
.peq-txt { font-size: 14px; }
.titulo-pag { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
.titulo-pag h1 { font-size: 56px; }
.titulo-pag p { margin: 10px 0 0; color: var(--grafite); max-width: 70ch; }

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

/* ---------- hero: o maior bug/queda do momento ---------- */
.vitrine { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 40px; align-items: center; padding: 8px 0 32px; border-bottom: var(--borda-gondola); margin-bottom: 18px; }
.vitrine .titulo { font-size: 17px; color: var(--grafite); margin: 0 0 12px; font-weight: 500; }
.vitrine h1 { font-size: 56px; max-width: 16ch; }
.vitrine .porque { font-size: 20px; margin: 16px 0 22px; max-width: 36ch; }
.vitrine .porque b { color: var(--encarte); }
.vitrine .acoes-v { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.vitrine .loja-v { color: var(--grafite); font-size: 15px; }
.vitrine .palco { position: relative; display: grid; justify-items: center; cursor: pointer; }
.vitrine .palco img { width: min(100%, 380px); aspect-ratio: 1; object-fit: contain; background: var(--foto); mix-blend-mode: multiply; border-radius: 4px; }
:root[data-tema="escuro"] .vitrine .palco img { mix-blend-mode: normal; }
.vitrine .palco .etq { position: absolute; bottom: -6px; right: 4%; transform-origin: 92% 0; animation: pendurar 1.1s cubic-bezier(.3, 1.5, .5, 1) both .15s; box-shadow: 0 10px 0 -4px rgba(0,0,0,.08); }
.vitrine .palco .de-v { position: absolute; bottom: 92px; right: 6%; font-family: var(--cond); font-stretch: 72%; font-weight: 700; font-size: 30px; color: var(--grafite); text-decoration: line-through; text-decoration-color: var(--encarte); text-decoration-thickness: 3px; }
@keyframes pendurar { 0% { transform: rotate(-9deg) translateY(-14px); opacity: 0; } 50% { opacity: 1; } 100% { transform: none; } }
.resumo-linha { font-size: 17px; color: var(--grafite); margin: 0 0 14px; max-width: 80ch; }
.resumo-linha b { color: var(--tinta); font-variant-numeric: tabular-nums; }
.resumo-linha .n-bug { color: var(--encarte); }
.busca-v { display: flex; gap: 8px; max-width: 560px; margin-top: 20px; }
.busca-v .campo { flex: 1; height: 46px; border: 2px solid var(--tinta); }

/* categorias: uma linha de texto condensado, não blocos com ícone */
.atalhos { display: flex; flex-wrap: wrap; gap: 4px 22px; margin: 0 0 40px; padding: 0; }
.atalho { font-family: var(--cond); font-stretch: 72%; font-weight: 700; font-size: 26px; line-height: 1.25; color: var(--grafite); }
.atalho:hover { color: var(--tinta); text-decoration: underline; text-decoration-color: var(--etiqueta); text-decoration-thickness: 5px; text-underline-offset: 3px; }

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

/* ---------- catálogo ---------- */
.catalogo { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 32px; align-items: start; }
.filtros { padding: 0 20px 0 0; position: sticky; top: 118px; display: flex; flex-direction: column; gap: 22px; max-height: calc(100vh - 140px); overflow: auto; scrollbar-width: thin; border-right: 1px solid var(--linha); background: none; }
.filtros h3 { font-family: var(--texto); font-stretch: 100%; font-size: 14px; font-weight: 700; color: var(--tinta); margin-bottom: 8px; letter-spacing: 0; }
.filtros select, .filtros .campo { width: 100%; }
.faixa { display: flex; gap: 8px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { border: 1.5px solid var(--linha); background: var(--papel); border-radius: 4px; padding: 5px 10px; font-size: 14px; cursor: pointer; white-space: nowrap; }
.chip:hover { border-color: var(--tinta); }
.chip.on { background: var(--etiqueta); border-color: var(--etiqueta); color: #16181d; font-weight: 700; }
.chip small { color: var(--grafite); margin-left: 4px; }
.chip.on small { color: #16181d; }
.barra { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.barra .total { color: var(--grafite); font-size: 15px; margin-right: auto; }
.aviso-busca { padding: 16px 18px; margin-bottom: 26px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; border-left: 6px solid var(--etiqueta); }
.aviso-busca p { margin: 0; flex: 1; min-width: 220px; max-width: 64ch; }
.mais { display: flex; justify-content: center; margin-top: 32px; }
.mostrar-filtros { display: none; }

/* ---------- favoritos ---------- */
.seguindo { padding: 22px; margin-bottom: 40px; }
.seguindo h2 { font-size: 30px !important; }
.seguir-form { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
.seguir-form .campo:first-child { flex: 1; min-width: 200px; }
.termo { display: inline-flex; align-items: center; gap: 4px; background: var(--etiqueta); color: #16181d; border-radius: 2px; padding: 4px 4px 4px 10px; font-weight: 700; font-size: 15px; }
.termo button { border: 0; background: transparent; cursor: pointer; color: inherit; width: 24px; height: 24px; border-radius: 2px; display: grid; place-items: center; }
.termo button:hover { background: rgba(0,0,0,.12); }
.termo button svg { width: 14px; }

/* ---------- alertas ---------- */
.alertas { display: flex; flex-direction: column; background: none; }
.alerta { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; gap: 16px; padding: 14px 0; border-top: 1px solid var(--linha); align-items: center; cursor: pointer; }
.alerta:first-child { border-top: 0; }
.alerta:hover .tit { text-decoration: underline; text-decoration-color: var(--etiqueta); text-decoration-thickness: 3px; }
.alerta .mini { width: 64px; height: 64px; display: grid; place-items: center; }
.alerta .mini img { max-width: 100%; max-height: 100%; object-fit: contain; background: var(--foto); mix-blend-mode: multiply; border-radius: 3px; }
.alerta .tit { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.alerta .motivo { color: var(--grafite); font-size: 14px; }
.alerta .lado { text-align: right; white-space: nowrap; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.alerta .quando { color: var(--cinza); font-size: 13px; }

/* ---------- lojas ---------- */
.add-loja { padding: 22px; margin-bottom: 30px; }
.add-loja form { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
.add-loja .campo { flex: 1; min-width: 240px; }
.lojas { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 0; border-top: 1px solid var(--linha); }
.loja { padding: 18px 18px 18px 0; display: flex; flex-direction: column; gap: 10px; border-bottom: 1px solid var(--linha); }
.loja-top { display: flex; align-items: center; gap: 12px; }
.loja-ico { width: 36px; height: 36px; border-radius: 4px; background: #fff; border: 1px solid var(--linha); display: grid; place-items: center; overflow: hidden; flex-shrink: 0; }
.loja-ico img { width: 22px; height: 22px; }
.loja h3 { font-size: 24px; }
.loja .dom { color: var(--cinza); font-size: 13px; }
.loja .linha { display: flex; gap: 14px; font-size: 14px; color: var(--grafite); flex-wrap: wrap; }
.loja .erro { color: var(--encarte); font-size: 14px; }
.loja .acoes { display: flex; gap: 6px; margin-top: auto; }
.loja.off { opacity: .55; }
.plat { font-size: 13px; color: var(--grafite); }
.interruptor { margin-left: auto; width: 40px; height: 22px; border-radius: 11px; background: var(--gondola2); border: 0; position: relative; cursor: pointer; flex-shrink: 0; }
.interruptor::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: left .18s; box-shadow: 0 1px 2px rgba(0,0,0,.3); }
.interruptor.on { background: var(--tinta); }
.interruptor.on::after { left: 21px; background: var(--etiqueta); }

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

/* ---------- responsivo ---------- */
@media (max-width: 960px) {
  .vitrine { grid-template-columns: 1fr; gap: 18px; }
  .vitrine .palco { order: -1; }
  .vitrine h1 { font-size: 44px; }
  .vitrine .palco .etq.grande { font-size: 64px; }
  .catalogo { grid-template-columns: 1fr; }
  .filtros { position: static; max-height: none; display: none; border-right: 0; padding: 0 0 20px; border-bottom: 1px solid var(--linha); }
  .filtros.aberto { display: flex; }
  .mostrar-filtros { display: inline-flex; }
  .prod { grid-template-columns: 1fr; }
  .prod .foto { min-height: 240px; border-right: 0; border-bottom: 1px solid var(--linha); }
  .prod .foto img { max-height: 260px; }
  .seta { display: none; }
}
@media (max-width: 640px) {
  .topo-in { flex-wrap: wrap; gap: 10px; padding: 10px 16px 6px; }
  .marca { font-size: 21px; }
  .busca { order: 3; flex-basis: 100%; max-width: none; }
  .abas { padding: 0 8px; }
  main { padding: 18px 16px 60px; }
  .vitrine h1 { font-size: 36px; }
  .vitrine .porque { font-size: 17px; }
  .vitrine .palco img { width: 74%; }
  .vitrine .palco .etq.grande { font-size: 52px; right: 0; }
  .vitrine .palco .de-v { font-size: 22px; bottom: 64px; right: 2%; }
  .atalho { font-size: 21px; }
  .atalhos { gap: 2px 16px; }
  .titulo-pag h1 { font-size: 40px; }
  .secao-cab h2 { font-size: 28px; }
  .grade { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 28px; }
  .grade .card:nth-child(2n + 1) { box-shadow: none; }
  .trilho { grid-auto-columns: 172px; }
  .card { padding: 0 10px; }
  .etq.media { font-size: 28px; }
  .prod .det { padding: 20px; }
  .prod h2 { font-size: 27px; }
  .prod .det .etq { font-size: 44px; }
  .semelhantes { padding: 4px 20px 20px; }
  .alerta { grid-template-columns: 52px minmax(0, 1fr); }
  .alerta .mini { width: 52px; height: 52px; }
  .alerta .lado { grid-column: 2; align-items: flex-start; }
  .cmp-linha { grid-template-columns: minmax(0, 1fr) auto; }
  .cmp-nome { display: none; }
  .toast { left: 16px; right: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}

.add-loja h2, .seguindo h2 { font-size: 30px !important; }
.trilho::-webkit-scrollbar { display: none; }

```
