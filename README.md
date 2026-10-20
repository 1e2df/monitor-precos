# Monitor de Preços

Site que junta os produtos de **tecnologia** de várias lojas num lugar só, guarda o histórico de preço
de cada produto e separa os **descontos de verdade** dos "de/por" inflados e dos prováveis **bugs de preço**.

Requer só Node.js 22+. Sem `npm install`: o banco é o SQLite que já vem no Node.

## Só tecnologia

Notebooks, PCs, celulares, tablets, hardware (placa de vídeo, processador, SSD, memória...), monitores,
TVs, áudio, games, periféricos, rede, câmeras, smartwatches e acessórios. Fica de fora o resto:
eletrodomésticos, cozinha, móveis, moda, farmácia, pet, brinquedos etc.

- **Lojas especializadas** (KaBuM!, Pichau, Ibyte, Motorola, WAZ, Aiwa, VAIO): entra tudo que não for
  claramente de outra área.
- **Lojas que vendem de tudo** (Carrefour, Americanas, Casa&Video, Fujioka, Multilaser, Philco, Britânia,
  Lojas MM, Multiloja, Sam's Club, Promobit): o monitor pesquisa termos como "notebook", "smart tv",
  "placa de video" e "headset" (lista em `tecnologia.js`), e só entra o que é claramente tecnologia.
- As outras 48 lojas ficam **pausadas** na aba Lojas. Dá para religar: só os produtos de tecnologia delas entram.
- Em cada loja ativa dá para escolher entre "Só tecnologia" e "Vende de tudo".
- Para voltar a monitorar tudo, use `"apenasTecnologia": false` em `config.json` e religue as lojas.

## Uso

Dê dois cliques em `iniciar.bat`. O site abre em `http://localhost:3100`.
Na primeira vez ele lê todas as lojas (uns 3 minutos); depois relê cada uma a cada hora.
Deixe a janela aberta.

- **Início**: números do catálogo, possíveis bugs, o que caiu de preço agora e os maiores descontos.
- **Catálogo**: busca em todas as lojas com filtros de loja, categoria, faixa de preço e desconto mínimo.
  Se a busca não encontrar nada, o monitor pesquisa o termo direto nas lojas na hora.
- **Bugs de preço**: *BUG DE PREÇO* (vermelho) quando o preço despenca em relação ao próprio histórico
  ou fica quase zero; *Bug?* quando está muito abaixo do preço "de", mas ainda sem histórico que confirme.
- **Favoritos**: só o que você marcou. Toque no ♥ de um produto, ou **siga uma busca** ("ssd 1tb",
  "ração golden", "iphone 15") com preço máximo opcional: o monitor pesquisa esses termos em todas as
  lojas em cada rodada e mostra só esses produtos.
- **Alertas**: histórico das mudanças de preço que valeram um aviso.
- **Lojas**: adicione qualquer loja. Cole só o endereço (ex.: `www.mondial.com.br`): se a loja tiver
  catálogo público (VTEX ou Shopify), o catálogo inteiro entra. Senão, cole o link de uma página de
  categoria/ofertas ou de um produto específico.

Clique num produto para ver o gráfico do histórico de preços, o preço normal, o mínimo e o máximo,
o preço no Pix, a **comparação com outras lojas**, os **cupons** da loja, ofertas parecidas e definir
um **preço alvo**.

## Comparação entre lojas

Produtos com código de barras (EAN) são reconhecidos em todas as lojas. No catálogo, cada produto aparece
uma vez, na loja mais barata, com a etiqueta "4 lojas · o mais barato" (dá para mostrar todas). Na ficha,
"Procurar em todas as lojas" pesquisa o código de barras na hora em todas as lojas VTEX.

## Lojas ativas (18)

KaBuM! (17 categorias), Pichau (8 categorias), Ibyte, Motorola, WAZ, Aiwa, VAIO, Carrefour, Americanas,
Casa&Video, Fujioka, Multilaser, Philco, Britânia, Lojas MM, Multiloja, Sam's Club e Promobit.

Mercado Livre, Magalu, Amazon, Casas Bahia, Terabyte e Fast Shop bloqueiam leitura automática.

## Como os bugs são separados do falso desconto

- **"de/por" inflado**: se mais de 5% dos produtos de uma loja aparecem com 70%+ de desconto, o "de" dela
  deixa de contar como bug (a loja recebe a etiqueta *"de" inflado*).
- **Loja que é barata mesmo**: se uma loja tem vários produtos 50%+ mais baratos que as outras ao mesmo
  tempo (genéricos de farmácia, por exemplo), isso conta como oferta, não como bug. Remédios genéricos
  nunca viram bug por comparação.
- **Bug confirmado** (vermelho) exige: queda de 55%+ em relação ao histórico do próprio produto,
  50%+ mais barato que o mesmo produto em 2 ou mais outras lojas, erro de casa decimal ou preço quase zero.
- **Revisão rápida**: a cada 5 minutos os suspeitos são conferidos de novo direto na loja. A ficha mostra
  há quanto tempo o bug está ativo, quando foi conferido, o estoque (quando a loja informa) e se esgotou.
  Os suspeitos novos com EAN também são procurados nas outras lojas.

## Cupons

A cada 6 horas o monitor busca os cupons de cada loja no Promobit. Lojas com cupom ganham a etiqueta
"cupom" nos cartões, e a ficha do produto lista os códigos (clique para copiar).

## Resumo diário

Todo dia às 8h sai um resumo das últimas 24h: bugs ativos, favoritos que baixaram, a melhor oferta de
cada busca seguida, produtos bem mais baratos que nas outras lojas e as maiores quedas. Ele aparece no
topo da aba Alertas, com um botão para enviar na hora. Hora e liga/desliga em `config.json` (`resumoDiario`).

## Notificações

Saem notificações para bugs confirmados e para qualquer mudança em favoritos e buscas seguidas.
No Windows aparece uma notificação do sistema. Para receber no celular, preencha em `config.json`:

- `notificar.ntfyTopico`: instale o app **ntfy** e assine um tópico com nome difícil de adivinhar.
- `notificar.telegram.token` e `chatId`: crie um bot com o @BotFather.
- `notificar.discordWebhook`: URL de webhook de um canal.

Em `config.json` também ficam o intervalo entre leituras, quantas páginas ler por loja e os limites de
desconto/bug.

## Arquivos

- `server.js`: site, API e agendamento das leituras
- `conectores.js`: leitura dos catálogos (VTEX, Shopify, páginas comuns, produtos avulsos)
- `extrair.js`: extrator genérico de preços de qualquer página (usa Edge/Chrome invisível quando precisa)
- `analisar.js`: regras de desconto e bug
- `db.js`: banco `catalogo.db`
- `site/`: interface

`node server.js uma-vez` lê as lojas vencidas e sai (para o Agendador de Tarefas).
Variáveis opcionais: `PORT`, `OPEN=0` (não abrir o navegador).

Use com moderação e respeite os termos de cada site. Lojas podem cancelar pedidos feitos com preço errado.
