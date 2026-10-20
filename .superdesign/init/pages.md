# Pages

All pages share `site/index.html` (shell) and `site/estilo.css` (all styles). Each page is a render function in `site/app.js`; dependencies are other functions in the same file (line numbers for `--context-file site/app.js:start:end`).

## inicio
Entry: `site/app.js` → `inicio()` line 400
Dependencies:
- `site/index.html`
- `site/estilo.css`
- `site/app.js:357:359` (ATALHOS)
- `site/app.js:362:371` (destaque)
- `site/app.js:373:397` (vitrine)
- `site/app.js:150:162` (descerPreco)
- `site/app.js:123:126` (trilho)
- `site/app.js:84:105` (cartao)
- `site/app.js:10:14` (etiqueta)

## catalogo
Entry: `site/app.js` → `catalogo()` line 431
Dependencies:
- `site/index.html`
- `site/estilo.css`
- `site/app.js:122:122` (grade)
- `site/app.js:84:105` (cartao)
- `site/app.js:10:14` (etiqueta)

## bugs
Entry: `site/app.js` → `bugs()` line 516
Dependencies:
- `site/index.html`
- `site/estilo.css`
- `site/app.js:431:513` (catalogo)
- `site/app.js:122:122` (grade)
- `site/app.js:84:105` (cartao)

## favoritos
Entry: `site/app.js` → `favoritos()` line 526
Dependencies:
- `site/index.html`
- `site/estilo.css`
- `site/app.js:122:122` (grade)
- `site/app.js:123:126` (trilho)
- `site/app.js:84:105` (cartao)

## alertas
Entry: `site/app.js` → `alertas()` line 559
Dependencies:
- `site/index.html`
- `site/estilo.css`
- `site/app.js:123:126` (trilho)
- `site/app.js:84:105` (cartao)
- `site/app.js:10:14` (etiqueta)

## lojas
Entry: `site/app.js` → `lojas()` line 599
Dependencies:
- `site/index.html`
- `site/estilo.css`

## produto (modal)
Entry: `site/app.js` → `abrirProduto()` line 192
Dependencies:
- `site/index.html`
- `site/estilo.css`
- `site/app.js:226:262` (fichaProduto)
- `site/app.js:265:278` (comparacao)
- `site/app.js:285:311` (grafico)
- `site/app.js:123:126` (trilho)
- `site/app.js:84:105` (cartao)
- `site/app.js:10:14` (etiqueta)

