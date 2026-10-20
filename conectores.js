// Lê o catálogo das lojas. Muitas lojas brasileiras rodam em VTEX ou Shopify, que têm catálogo
// público em JSON; o resto é lido pelo extrator genérico de HTML (extrair.js).
const { extrair, limpar } = require('./extrair');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const espera = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url, tentativas = 2) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', 'Accept-Language': 'pt-BR' }, signal: AbortSignal.timeout(25000) });
      const t = await r.text();
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      if (r.status >= 400) { const e = new Error(`HTTP ${r.status}`); e.final = true; throw e; }
      return JSON.parse(t);
    } catch (e) {
      if (e.final || i + 1 >= tentativas) throw e;
      await espera(3000 * (i + 1));
    }
  }
}

// "de" absurdo (ex.: 9.999.876) é lixo de cadastro; 10x/100x exato pode ser erro de casa decimal e fica
function precoDeValido(preco, de) {
  if (!de || !preco || de <= preco * 1.01) return null;
  const r = de / preco;
  if (r > 15 && ![10, 100, 1000].some(f => Math.abs(r - f) / f < 0.03)) return null;
  return Math.round(de * 100) / 100;
}

const nomeDaLoja = dominio => {
  const base = dominio.replace(/^(www|loja|shop|store)\./, '').split('.')[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
};

// ---------- VTEX ----------
function produtoVtex(p, base) {
  let melhor = null;
  for (const it of p.items || []) for (const s of it.sellers || []) {
    const o = s.commertialOffer || {};
    if (!(o.Price > 0) || o.AvailableQuantity === 0) continue;
    if (!melhor || o.Price < melhor.o.Price) melhor = { o, it };
  }
  if (!melhor) return null;
  const { o, it } = melhor;
  const preco = o.Price;
  const ean = /^\d{8,14}$/.test(it.ean || '') && !/^0+$/.test(it.ean) ? it.ean : null;
  // categoria do 2º nível ("Informática/Notebooks" -> "Notebooks"), mais útil que a do topo
  const cat = (p.categories || []).sort((a, b) => a.length - b.length).find(c => c.split('/').filter(Boolean).length >= 2) || p.categories?.[0] || '';
  return {
    chave: String(p.productId),
    nome: limpar(p.productName),
    marca: p.brand || null,
    categoria: (s => s[1] || s[0])(cat.split('/').filter(Boolean)) || null,
    // a API às vezes devolve o domínio interno (vtexcommercestable): troca pelo da loja
    url: new URL(new URL(p.link || `/${p.linkText}/p`, base).pathname, base).href,
    imagem: (it.images || p.items?.[0]?.images || [])[0]?.imageUrl || null,
    preco,
    precoDe: precoDeValido(preco, Math.max(o.ListPrice || 0, o.PriceWithoutDiscount || 0)),
    precoPix: o.spotPrice > 0 && o.spotPrice < preco * 0.995 ? o.spotPrice : null,
    estoque: o.AvailableQuantity > 0 && o.AvailableQuantity < 10000 ? o.AvailableQuantity : null, // 10000 = "muito"
    ean,
    disponivel: true,
  };
}

// soTermos: só pesquisa os termos (busca ao vivo em todas as lojas)
// comDesconto: para cada termo pega também a página ordenada por desconto (lojas mistas lidas só por termos)
async function* vtex(loja, { termos = [], paginas = 6, esperaMs = 1200, soTermos = false, comDesconto = false }) {
  const base = `https://${loja.dominio}`;
  const buscas = [
    ...(soTermos ? [] : [
      ...Array.from({ length: paginas }, (_, i) => ({ sort: 'discount:desc', page: i + 1, query: '' })),
      { sort: 'orders:desc', page: 1, query: '' }, { sort: 'orders:desc', page: 2, query: '' },
      { sort: 'release:desc', page: 1, query: '' },
    ]),
    ...termos.flatMap(t => [{ sort: '', page: 1, query: t }, ...(comDesconto ? [{ sort: 'discount:desc', page: 1, query: t }] : [])]),
  ];
  const esgotado = new Set(); // ordenação que já acabou não precisa de mais páginas
  for (const b of buscas) {
    if (esgotado.has(b.sort + b.query)) continue;
    const u = `${base}/api/io/_v/api/intelligent-search/product_search/?count=50&page=${b.page}&query=${encodeURIComponent(b.query)}`
      + `${b.sort ? '&sort=' + b.sort : ''}&hideUnavailableItems=true&locale=pt-BR`;
    const j = await getJSON(u);
    if ((j.products || []).length < 50) esgotado.add(b.sort + b.query);
    yield (j.products || []).map(p => produtoVtex(p, base)).filter(Boolean);
    await espera(esperaMs);
  }
}

async function* vtexLegado(loja, { termos = [], paginas = 6, esperaMs = 1200, soTermos = false, comDesconto = false }) {
  const base = `https://${loja.dominio}`;
  const buscas = [
    ...(soTermos ? [] : [
      ...Array.from({ length: paginas }, (_, i) => ({ O: 'OrderByBestDiscountDESC', de: i * 50 })),
      { O: 'OrderByTopSaleDESC', de: 0 }, { O: 'OrderByTopSaleDESC', de: 50 },
    ]),
    ...termos.flatMap(t => [{ O: 'OrderByScoreDESC', de: 0, ft: t }, ...(comDesconto ? [{ O: 'OrderByBestDiscountDESC', de: 0, ft: t }] : [])]),
  ];
  const esgotado = new Set();
  for (const b of buscas) {
    if (esgotado.has(b.O + b.ft)) continue;
    const u = `${base}/api/catalog_system/pub/products/search?_from=${b.de}&_to=${b.de + 49}&O=${b.O}${b.ft ? '&ft=' + encodeURIComponent(b.ft) : ''}`;
    const j = await getJSON(u);
    if (!Array.isArray(j) || j.length < 50) esgotado.add(b.O + b.ft);
    yield (Array.isArray(j) ? j : []).map(p => produtoVtex(p, base)).filter(Boolean);
    await espera(esperaMs);
  }
}

// ---------- Shopify ----------
function produtoShopify(p, base) {
  const vs = (p.variants || []).filter(v => v.available !== false && parseFloat(v.price) > 0);
  if (!vs.length) return null;
  const v = vs.reduce((a, b) => (parseFloat(b.price) < parseFloat(a.price) ? b : a));
  const preco = parseFloat(v.price);
  return {
    ean: /^\d{8,14}$/.test(v.barcode || '') ? v.barcode : null,
    chave: String(p.id),
    nome: limpar(p.title),
    marca: p.vendor || null,
    categoria: p.product_type || null,
    url: `${base}/products/${p.handle}`,
    imagem: p.images?.[0]?.src || p.image || p.featured_image || null,
    preco,
    precoDe: precoDeValido(preco, parseFloat(v.compare_at_price || p.compare_at_price_max || 0)),
    disponivel: true,
  };
}

async function* shopify(loja, { termos = [], paginas = 4, esperaMs = 1200, soTermos = false }) {
  const base = `https://${loja.dominio}`;
  for (let n = 1; n <= (soTermos ? 0 : paginas); n++) {
    const j = await getJSON(`${base}/products.json?limit=250&page=${n}`);
    const ps = j.products || [];
    yield ps.map(p => produtoShopify(p, base)).filter(Boolean);
    if (ps.length < 250) break;
    await espera(esperaMs);
  }
  for (const t of termos) {
    if (!soTermos) await espera(esperaMs);
    try {
      const j = await getJSON(`${base}/search/suggest.json?q=${encodeURIComponent(t)}&resources[type]=product&resources[limit]=10`);
      const ps = j.resources?.results?.products || [];
      yield ps.map(p => {
        const preco = parseFloat(p.price);
        if (!(preco > 0) || p.available === false) return null;
        return { chave: String(p.id), nome: limpar(p.title), marca: p.vendor, categoria: p.type || null, url: new URL(p.url, base).href.split('?')[0],
          imagem: p.image || p.featured_image?.url || null, preco, precoDe: precoDeValido(preco, parseFloat(p.compare_at_price_max || 0)), disponivel: true };
      }).filter(Boolean);
    } catch {}
  }
}

// ---------- páginas comuns (listagens e produtos avulsos) ----------
async function* pagina(loja, { esperaMs = 1200 }) {
  for (const url of loja.urls || []) {
    const r = await extrair(url, { tipo: 'pagina' });
    yield r.itens.map(i => ({ ...i, chave: i.url && i.url !== url ? i.url : `${url}#${i.nome}` }));
    await espera(esperaMs);
  }
}

async function* avulso(loja, { esperaMs = 1200 }) {
  for (const url of loja.urls || []) {
    try {
      const r = await extrair(url, { tipo: 'produto' });
      if (r.produto) yield [{ ...r.produto, chave: url, url }];
    } catch (e) { console.log(`  ✗ ${url}: ${e.message}`); }
    await espera(esperaMs);
  }
}

const COLETORES = { vtex, 'vtex-legado': vtexLegado, shopify, pagina, avulso };

// ---------- um produto só (revisão rápida de bugs) ----------
// devolve o produto atualizado, null se saiu de linha/esgotou, ou lança erro se a loja não respondeu
async function lerProduto(loja, produto) {
  const base = `https://${loja.dominio}`;
  const chave = produto.id.slice(String(loja.id).length + 1);
  if (loja.plataforma === 'vtex') {
    const j = await getJSON(`${base}/api/io/_v/api/intelligent-search/product_search/?query=product:${encodeURIComponent(chave)}&count=1&locale=pt-BR`);
    const p = (j.products || []).find(x => String(x.productId) === chave);
    return p ? produtoVtex(p, base) : null;
  }
  if (loja.plataforma === 'vtex-legado') {
    const j = await getJSON(`${base}/api/catalog_system/pub/products/search?fq=productId:${encodeURIComponent(chave)}`);
    return Array.isArray(j) && j[0] ? produtoVtex(j[0], base) : null;
  }
  if (loja.plataforma === 'shopify') {
    const j = await getJSON(`${produto.url.split('?')[0]}.json`);
    return j.product ? produtoShopify({ ...j.product, variants: j.product.variants.map(v => ({ ...v, available: v.available ?? true })) }, base) : null;
  }
  const r = await extrair(produto.url, { tipo: 'produto' });
  return r.produto ? { ...r.produto, chave, url: produto.url } : null;
}

// procura o mesmo produto (EAN) numa loja VTEX
async function buscarEan(loja, ean) {
  const base = `https://${loja.dominio}`;
  const lista = loja.plataforma === 'vtex'
    ? (await getJSON(`${base}/api/io/_v/api/intelligent-search/product_search/?query=${ean}&count=3&hideUnavailableItems=true&locale=pt-BR`, 1)).products || []
    : await getJSON(`${base}/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${ean}`, 1);
  return (Array.isArray(lista) ? lista : []).map(p => produtoVtex(p, base)).filter(p => p && p.ean === ean);
}

// ---------- cupons (Promobit) ----------
async function cuponsDaLoja(loja) {
  const slug = loja.dominio.replace(/^(www|loja|shop|store|br)\./, '').split('.')[0];
  const r = await fetch(`https://www.promobit.com.br/cupons/loja/${slug}/`, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' }, signal: AbortSignal.timeout(25000) });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const m = (await r.text()).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  const sc = m ? JSON.parse(m[1]).props?.pageProps?.serverCoupons : null;
  const lista = Array.isArray(sc) ? sc : sc?.coupons || [];
  const agora = Date.now();
  return lista
    .filter(c => c.couponCode && (!c.storeDomain || loja.dominio.endsWith(c.storeDomain)) && (!c.couponUntil || Date.parse(c.couponUntil) > agora))
    .map(c => ({
      id: String(c.couponId), codigo: c.couponCode, titulo: limpar(c.couponTitle || c.couponDiscountOn || ''),
      desconto: c.couponDiscountShort || c.couponDiscount || null, validade: c.couponUntil || null,
      url: c.couponUrl ? new URL(c.couponUrl, 'https://www.promobit.com.br').href : null,
    }));
}

// ---------- detectar plataforma ----------
async function detectar(entrada) {
  const txt = String(entrada || '').trim();
  const url = new URL(/^https?:\/\//i.test(txt) ? txt : `https://${txt}`);
  const dominio = url.host;
  const base = `https://${dominio}`;
  const temCaminho = url.pathname.length > 1;
  const tentar = async f => { try { return await f(); } catch { return false; } };
  const pareceProduto = /\/p$|\/p\/|\/produto\/|\/products\/|\/dp\/|\/item\/|\/MLB-?\d|-p-\d|\.html$/i.test(url.pathname);

  if (pareceProduto) {
    const p = await tentar(() => extrair(url.href, { tipo: 'produto' }));
    if (p?.produto) return { plataforma: 'avulso', dominio, urls: [url.href] };
  }
  // link de categoria de uma loja com catálogo público: melhor pegar o catálogo inteiro
  {
    if (await tentar(async () => {
      const j = await getJSON(`${base}/api/io/_v/api/intelligent-search/product_search/?count=5&query=&hideUnavailableItems=true`, 1);
      return (j.products || []).some(p => produtoVtex(p, base));
    })) return { plataforma: 'vtex', dominio };
    if (await tentar(async () => {
      const j = await getJSON(`${base}/api/catalog_system/pub/products/search?_from=0&_to=4`, 1);
      return Array.isArray(j) && j.some(p => produtoVtex(p, base));
    })) return { plataforma: 'vtex-legado', dominio };
    if (await tentar(async () => {
      const j = await getJSON(`${base}/products.json?limit=5`, 1);
      return (j.products || []).some(p => produtoShopify(p, base));
    })) return { plataforma: 'shopify', dominio };
  }
  // sem API: precisa de uma página com produtos
  const r = await tentar(() => extrair(url.href, { tipo: 'pagina' }));
  if (r?.itens?.length >= 2) return { plataforma: 'pagina', dominio, urls: [url.href] };
  if (temCaminho && !pareceProduto) {
    const p = await tentar(() => extrair(url.href, { tipo: 'produto' }));
    if (p?.produto) return { plataforma: 'avulso', dominio, urls: [url.href] };
  }
  throw new Error(temCaminho
    ? 'não encontrei produtos com preço nessa página'
    : 'essa loja não tem catálogo público; cole o link de uma página de categoria ou de ofertas dela');
}

module.exports = { COLETORES, detectar, nomeDaLoja, precoDeValido, lerProduto, buscarEan, cuponsDaLoja };
