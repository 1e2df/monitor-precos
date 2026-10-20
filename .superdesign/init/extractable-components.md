# Extractable components

#### Layout Components
## TopBar
- Source: `site/index.html` (header.topo) + `site/estilo.css` "topo" section
- Category: layout
- Description: Sticky header with price-tag logo, wordmark "Monitor de Preços", 2px-bordered search input, theme toggle; tab row below
- Extractable props: activeItem (string, default: "inicio"), bugCount (number, default: 13), favCount (number, default: 0)
- Hardcoded: price-tag logo (CSS shape), tab labels (Início, Catálogo, Bugs de preço, Favoritos, Alertas, Lojas), search placeholder, icons

#### Basic Components
## PriceTag
- Source: `site/app.js` `etiqueta()` line 10
- Category: basic
- Description: Yellow retail price tag; red variant for confirmed bugs
- Extractable props: none (value and size passed inline)
- Hardcoded: anatomy (R$ small, integer, superscript underlined cents)

## ProductOnShelf
- Source: `site/app.js` `cartao()` line 84
- Category: basic
- Description: Product loose on the shelf with tag below
- Extractable props: none
- Hardcoded: layout, badge styles

## Shelf
- Source: `site/app.js` `trilho()` line 123
- Category: basic
- Description: Horizontal scroll row of products with 6px shelf edge
- Extractable props: none
