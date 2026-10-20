# Monitor de Preços — design system (etiqueta eletrônica)

## Product
A local website (Portuguese, Brazil) that reads the catalogs of ~18 Brazilian tech stores every hour and keeps the price history of each product. It separates real discounts from inflated "de/por" prices and flags probable price bugs (price far below the product's own history, or far below the same barcode in other stores). Tech products only: notebooks, phones, GPUs/CPUs/SSD, monitors, TVs, audio, consoles, peripherals.

Audience: Brazilian deal hunters and tech buyers who check several times a day and need to scan fast.
Job: in seconds, see what really dropped in price and what looks like a bug; compare the same product across stores; keep favorites and followed searches.

Key pages: Início (hero label with the current biggest bug + shelves of bugs / cheaper than other stores / price drops / biggest discounts), Catálogo (filters + grid), Bugs de preço, Favoritos, Alertas (daily summary + alert list), Lojas, product sheet dialog (price, reason, history chart, store comparison, coupons).

## Concept
Electronic shelf labels (ESL / e-ink price labels of modern stores). Each product photo sits on the shelf; below it runs a continuous metal rail and a charcoal plastic label frame holding an e-paper screen with the price. Real ESLs have only black, white and red pixels plus a small LED: so does the site. Labels stay light even in dark mode (only the store aisle gets dark).

## Color
- Aisle (page) #E3E4DF — dark mode #111214
- E-paper screen #F1F1EC (always light)
- E-ink black #18191B
- E-ink red #C4122F — confirmed bugs, price drops, strikethrough of old price, LED
- Plastic frame #2A2C30
- Metal rail #9A9C9F (dark mode #6C6E72)
- Secondary text #55585E, tertiary #84878D, hairline #C8C9C3; product photos on #FFFFFF
Never: gradients, extra hues (no green/yellow/blue), glassmorphism, drop shadows on cards.

## Typography
- IBM Plex Sans Condensed 600: prices, headings, category keys, wordmark.
- IBM Plex Sans 400–600: body, 15px/1.45.
- Price anatomy: small raised "R$", big condensed integer, underlined superscript cents; red when the bug is confirmed. Old price struck through in red.
- Scale: 12, 13, 14.5, 15, 18, 22, 24, 28, 30, 42, 56, 84.
- Sentence case everywhere. No all-caps, no " · " meta strings, no "→" on links, no eyebrows.

## Layout & components
- Left aligned, max width 1280px, 24px gutters (16px phones).
- Header: tiny ESL logo (plastic frame, e-paper screen, red LED dot) + condensed wordmark, search with 2px plastic border on e-paper, theme toggle; tabs with 3px underline, red count on "Bugs de preço"; 2px metal rule under the header.
- Hero ("vitrine"): one big ESL — 12px plastic frame, e-paper screen with photo left (340px) and info right (eyebrow line in sentence case, name 42px, reason with red %, old price struck, 84px price, primary button, dashed-rule footer "Preço lido há X, conferido há Y"); red LED top-right blinking.
- Product on shelf: white photo stage (heart top-right) → 6px metal rail segment that bleeds into the gap so the rail is continuous → ESL frame (8px radius, 6px plastic padding) whose screen holds: small ink tags (red "Bug de preço", outlined red "Bug?", red "▼ 18%"), store, name (2 lines), old price, price, Pix, text signals; LED dot on confirmed bugs. Labels in a row share the same height.
- Category links: one non-wrapping row of e-paper keys (1px metal border); hover = plastic.
- Panels: e-paper with 1px hairline, 6px radius. Chips 4px radius; active chip = plastic with e-paper text.
- Dialog: e-paper sheet with a 10px plastic outline (a big label).
- Radius hierarchy: tags 2px, chips 4px, buttons 5px, panels 6px, labels 8px, hero/dialog 12–14px.

## Motion
One page-load moment only: the hero screen does the e-ink refresh flash (two quick inversions, steps) when it appears. Persistent signal: the hero LED blinks slowly while a bug is confirmed. Everything else responds to actions (heart pop, dialog open, toast). Respect prefers-reduced-motion.
