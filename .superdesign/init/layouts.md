# Layouts

Single app shell in `site/index.html`: sticky header (price-tag logo + wordmark "Monitor de Preços", big search input, theme toggle) with a tab row below (Início, Catálogo, Bugs de preço [red count], Favoritos [count], Alertas, Lojas). Pages render into `<main id="app">`. Product details open in a `<dialog id="modal">`. A thin yellow loading bar (#carga) shows while stores are being read. Toast bottom-left.

## `site/index.html` (full)
```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Monitor de Preços</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><path d='M3 8h20l6 8-6 8H3z' fill='%23ffd200' stroke='%2316181d' stroke-width='2'/><circle cx='22' cy='16' r='2' fill='white' stroke='%2316181d' stroke-width='1.5'/></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap">
<link rel="stylesheet" href="estilo.css?v=5">
</head>
<body>
<div class="carga" id="carga" hidden></div>
<header class="topo">
  <div class="topo-in">
    <a href="#/" class="marca"><span class="logo"><svg viewBox="0 0 32 32"><path d="M7 21l6-6 4 4 8-9" /></svg></span><span>Monitor de Preços</span></a>
    <form class="busca" id="busca-topo" role="search">
      <svg viewBox="0 0 24 24" class="ico"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input name="q" placeholder="Buscar em todas as lojas: notebook, rtx 4060, iphone, ssd…" autocomplete="off">
    </form>
    <div class="topo-acoes">
      <span class="status" id="status" hidden></span>
      <button class="icone" id="tema" title="Tema claro/escuro" aria-label="Alternar tema"><svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg></button>
    </div>
  </div>
  <nav class="abas" id="abas">
    <a href="#/" data-v="inicio">Início</a>
    <a href="#/catalogo" data-v="catalogo">Catálogo</a>
    <a href="#/bugs" data-v="bugs">Bugs de preço <b class="cont" id="c-bugs"></b></a>
    <a href="#/favoritos" data-v="favoritos">Favoritos <b class="cont" id="c-fav"></b></a>
    <a href="#/alertas" data-v="alertas">Alertas</a>
    <a href="#/lojas" data-v="lojas">Lojas</a>
  </nav>
</header>

<main id="app"></main>

<dialog id="modal" class="modal">
  <button class="icone fechar" id="fechar" aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  <div id="modal-corpo"></div>
</dialog>

<div class="toast" id="toast" hidden></div>
<script src="app.js?v=5"></script>
</body>
</html>

```

## Header / tabs CSS (`site/estilo.css`)
```css
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
```

## Router + counters (`site/app.js`)
```js
function rota() {
  const [caminho, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const nome = caminho.split('/')[0];
  const params = new URLSearchParams(qs || '');
  document.querySelectorAll('#abas a').forEach(a => a.classList.toggle('on', a.dataset.v === (nome || 'inicio')));
  if (modal.open) modal.close();
  (ROTAS[nome] || inicio)(params);
  window.scrollTo(0, 0);
}
```

```js
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
```
