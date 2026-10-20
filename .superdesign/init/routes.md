# Routes

Hash routing in `site/app.js` (`ROTAS` + `rota()`), all inside the shell of `site/index.html`. Data comes from a local JSON API (`/api/resumo`, `/api/produtos`, `/api/produtos/:id`, `/api/lojas`, ...).

| Hash | Render function | What it shows |
|---|---|---|
| `#/` | `inicio()` (site/app.js:400) | Home: "vitrine" hero with the current biggest price bug (big product photo + huge price tag that counts down from old to current price), one-sentence daily summary, category links as a line of condensed words, then horizontal shelves: Possíveis bugs, Bem mais barato que nas outras lojas, Caíram de preço agora, Maiores descontos. |
| `#/catalogo?q=&loja=&categoria=&ord=&min=&max=&off=&selo=&mudou=&comparar=&agrupar=` | `catalogo()` (site/app.js:431) | Catalog: page title, search-again banner, left filter column (ordenar, loja, preço, desconto mínimo chips, mostrar chips, agrupar lojas, categorias), product grid with shelf borders, "Carregar mais". |
| `#/bugs` | `bugs()` (site/app.js:516) | Catalog variant fixed to bug filter with explanation subtitle. |
| `#/favoritos` | `favoritos()` (site/app.js:526) | Followed searches panel (yellow term tags + add form), favorite products grid, one shelf per followed search. |
| `#/alertas` | `alertas()` (site/app.js:559) | Daily summary panel with shelves, then alert list rows (thumb, badge, title, reason, price tag, time). |
| `#/lojas` | `lojas()` (site/app.js:599) | Add-store form, list of active stores (favicon, name, domain, toggle, platform, counts, focus chips, actions), paused stores section. |

## Router config (`site/app.js`)
```js
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

```
