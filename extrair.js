// Extrai preços de qualquer página: JSON-LD (schema.org), meta tags, microdata,
// JSON embutido (Next.js, VTEX etc.) e, por último, o texto visível ("de R$ X por R$ Y").
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

// ---------- números ----------
// maquina=true: dado estruturado ("1299.90"); false: texto humano ("R$ 1.299,90", "$1,299.90")
function parsePreco(v, maquina = true) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) && v > 0 ? v : null;
  let s = String(v).replace(/[\s ]/g, '');
  const m = s.match(/\d[\d.,]*/);
  if (!m) return null;
  s = m[0].replace(/[.,]$/, '');
  const ultPonto = s.lastIndexOf('.'), ultVirg = s.lastIndexOf(',');
  if (ultPonto >= 0 && ultVirg >= 0) {
    const dec = ultPonto > ultVirg ? '.' : ',';
    s = s.split(dec === '.' ? ',' : '.').join('').replace(dec, '.');
  } else if (ultVirg >= 0) {
    // "1,29" decimal; "1,299" ou "1,299,000" milhar
    s = /,\d{3}$/.test(s) && !maquina ? s.replace(/,/g, '') : s.replace(/,(?=\d*$)/, '.').replace(/,/g, '');
  } else if (ultPonto >= 0 && !maquina && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ''); // "1.299" em texto brasileiro
  }
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? n : null;
}

// ---------- html ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
function decodificar(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (t, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e.toLowerCase()] ?? t;
  });
}
const limpar = s => decodificar(s).replace(/\s+/g, ' ').trim();

// "R$ <span>1.299</span>,90" vira "R$ 1.299 ,90" ao tirar as tags
const JUNTAR_NUM = /(\d) ?([.,]) ?(?=\d)/g;
function textoVisivel(html) {
  return limpar(html.replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(JUNTAR_NUM, '$1$2');
}

function meta(html, nomes) {
  for (const n of nomes) {
    const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${n}["'][^>]*>`, 'i');
    const tag = html.match(re);
    if (tag) {
      const c = tag[0].match(/content=["']([^"']*)["']/i);
      if (c) return decodificar(c[1]);
    }
  }
  return null;
}

function scripts(html) {
  const out = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) out.push({ attrs: m[1], corpo: m[2] });
  return out;
}

function tentarJSON(txt) {
  txt = txt.trim().replace(/^<!--|-->$/g, '').trim();
  try { return JSON.parse(txt); } catch {}
  try { return JSON.parse(txt.replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u001f]+/g, ' ')); } catch {}
  return null;
}

const absoluta = (u, base) => { try { return new URL(u, base).href; } catch { return u || null; } };

// ---------- fontes ----------
const temTipo = (n, t) => [].concat(n?.['@type'] || []).some(x => String(x).toLowerCase().includes(t));

function deJsonLd(html, base) {
  const itens = [];
  for (const s of scripts(html)) {
    if (!/application\/ld\+json/i.test(s.attrs)) continue;
    const dados = tentarJSON(s.corpo);
    if (!dados) continue;
    const visitar = (n, d) => {
      if (!n || typeof n !== 'object' || d > 10) return;
      if (Array.isArray(n)) return n.forEach(x => visitar(x, d + 1));
      if (temTipo(n, 'product') && n.offers) {
        const ofertas = [].concat(n.offers).flatMap(o => o?.offers ? [].concat(o.offers) : [o]).filter(Boolean);
        let preco = null, de = null, disp = null, moeda = null;
        for (const o of [].concat(n.offers)) {
          if (!o) continue;
          const specs = [].concat(o.priceSpecification || []);
          const lista = specs.find(p => /ListPrice|Strikethrough|MSRP/i.test(p.priceType || ''));
          const venda = specs.find(p => !p.priceType || /SalePrice/i.test(p.priceType));
          const p = parsePreco(o.price) ?? parsePreco(o.lowPrice) ?? parsePreco(venda?.price);
          if (p != null && (preco == null || p < preco)) { preco = p; moeda = o.priceCurrency || venda?.priceCurrency; }
          if (lista) de = parsePreco(lista.price);
          if (o.availability && disp !== true) disp = !/OutOfStock|SoldOut|Discontinued/i.test(o.availability);
        }
        if (preco == null) for (const o of ofertas) {
          const p = parsePreco(o.price);
          if (p != null && (preco == null || p < preco)) { preco = p; moeda = o.priceCurrency; }
        }
        if (preco != null) itens.push({
          nome: limpar(n.name), preco, precoDe: de && de > preco ? de : null, moeda, disponivel: disp,
          url: absoluta(n.url || n.offers?.url || base, base), imagem: [].concat(n.image || [])[0]?.url || [].concat(n.image || [])[0] || null,
          fonte: 'json-ld',
        });
      }
      for (const k in n) if (k !== 'offers' && typeof n[k] === 'object') visitar(n[k], d + 1);
    };
    visitar(dados, 0);
  }
  return itens;
}

function deMeta(html, base) {
  const preco = parsePreco(meta(html, ['product:price:amount', 'og:price:amount', 'product:sale_price:amount', 'price', 'twitter:data1']));
  if (preco == null) return [];
  const de = parsePreco(meta(html, ['product:original_price:amount', 'og:original_price:amount']));
  const disp = meta(html, ['product:availability', 'og:availability']);
  return [{
    nome: meta(html, ['og:title', 'twitter:title']), preco, precoDe: de && de > preco ? de : null,
    moeda: meta(html, ['product:price:currency', 'og:price:currency', 'priceCurrency']),
    disponivel: disp ? !/out|esgot|indispon/i.test(disp) : null, url: base, fonte: 'meta',
  }];
}

function deMicrodata(html, base) {
  const m = html.match(/itemprop=["']price["'][^>]*?(?:content=["']([^"']+)["'][^>]*>|>([^<]+)<)/i)
    || html.match(/content=["']([^"']+)["'][^>]*itemprop=["']price["']/i);
  if (!m) return [];
  const preco = m[1] ? parsePreco(m[1]) : parsePreco(m[2], false);
  return preco != null ? [{ nome: null, preco, precoDe: null, url: base, fonte: 'microdata' }] : [];
}

const K_PRECO = /^(price|pixprice|preco|preço|saleprice|sellingprice|finalprice|bestprice|spotprice|currentprice|pricewithdiscount|offerprice|promotionalprice|discountprice|valor)$/i;
const K_DE = /^(listprice|originalprice|oldprice|regularprice|pricefrom|precode|fullprice|strikethroughprice|baseprice|priceold|wasprice|pricewithoutdiscount|precoantigo|msrp)$/i;
const K_NOME = /^(name|nome|title|productname|producttitle)$/i;
const K_URL = /^(url|link|href|permalink|producturl|linktext|detailurl)$/i;
const K_IMG = /^(image|imagem|img|thumbnail|imageurl|picture|foto)$/i;

function deJsonEmbutido(html, base) {
  const itens = [], vistos = new Set();
  let nos = 0;
  const visitar = (n, d) => {
    if (!n || typeof n !== 'object' || d > 14 || ++nos > 40000) return;
    if (Array.isArray(n)) return n.forEach(x => visitar(x, d + 1));
    // vários campos de preço (ex.: price = cartão, priceWithDiscount = Pix): o menor é o "por", o maior o "de"
    const precos = [], des = [];
    let nome = null, url = null, imagem = null, categoria = null;
    for (const k in n) {
      const v = n[k];
      if (v == null) continue;
      if (typeof v !== 'object') {
        if (K_PRECO.test(k)) { const p = parsePreco(v); if (p) precos.push(p); }
        else if (K_DE.test(k)) { const p = parsePreco(v); if (p) des.push(p); }
        else if (K_NOME.test(k) && typeof v === 'string' && v.length > 3 && !nome) nome = v;
        else if (K_URL.test(k) && typeof v === 'string' && !url) url = v;
        else if (K_IMG.test(k) && typeof v === 'string' && /^https?:\/\//.test(v) && !imagem) imagem = v;
        else if (/^(category|categoria|categoryname)$/i.test(k) && typeof v === 'string' && !categoria) categoria = (s => s[1] || s[0])(v.split('/').map(x => x.trim()).filter(Boolean));
      } else if (K_PRECO.test(k) && !Array.isArray(v) && (v.value != null || v.amount != null)) {
        const p = parsePreco(v.value ?? v.amount); if (p) precos.push(p);
      }
    }
    // Kabum e afins: /produto/<código>/<slug>
    if (!url && n.code && typeof n.friendlyName === 'string') url = `/produto/${n.code}/${n.friendlyName}`;
    if (precos.length && nome) {
      const preco = Math.min(...precos), de = Math.max(...des, ...precos);
      const chave = nome + '|' + preco;
      if (!vistos.has(chave)) {
        vistos.add(chave);
        itens.push({ nome: limpar(nome), preco, precoDe: de > preco * 1.01 ? de : null, url: url ? absoluta(url, base) : null, imagem, categoria, fonte: 'json' });
      }
    }
    for (const k in n) {
      const v = n[k];
      if (typeof v === 'object') visitar(v, d + 1);
      else if (typeof v === 'string' && v.length > 200 && /^\s*[[{]/.test(v)) { const j = tentarJSON(v); if (j) visitar(j, d + 1); } // JSON dentro de string
    }
  };
  for (const s of scripts(html)) {
    if (/ld\+json/i.test(s.attrs) || s.corpo.length > 8e6) continue;
    const c = s.corpo.trim();
    let dados = null;
    if (c[0] === '{' || c[0] === '[') dados = tentarJSON(c);
    else { const i = c.indexOf('{'), f = c.lastIndexOf('}'); if (i > 0 && f > i && /=\s*$/.test(c.slice(0, i))) dados = tentarJSON(c.slice(i, f + 1)); }
    if (dados) visitar(dados, 0);
  }
  return itens;
}

const MOEDA = '(?:R\\$|US\\$|U\\$|\\$|€|£)';
const NUM = '(\\d{1,3}(?:[.,\\s]\\d{3})*(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)';
function precosNoTexto(txt) {
  const re = new RegExp(MOEDA + '\\s*' + NUM, 'g');
  const out = []; let m;
  while ((m = re.exec(txt))) { const p = parsePreco(m[1], false); if (p) out.push({ p, i: m.index }); }
  return out;
}
function deParesDePor(txt) {
  const re = new RegExp(`(?:de|era|antes)\\s*:?\\s*${MOEDA}\\s*${NUM}\\s*(?:por|para|agora|sai por)\\s*:?\\s*(?:apenas\\s*)?${MOEDA}\\s*${NUM}`, 'gi');
  const out = []; let m;
  while ((m = re.exec(txt))) {
    const de = parsePreco(m[1], false), por = parsePreco(m[2], false);
    if (de && por && de > por) out.push({ de, por, i: m.index });
  }
  return out;
}

// Listagens sem dados estruturados: cada preço visível pertence ao último link com cara de título de produto.
// foto do cartão: a primeira <img> com endereço de verdade (ignora placeholders data:)
function srcDaImg(tag) {
  for (const at of ['data-src', 'src', 'data-srcset', 'srcset']) {
    const m = tag.match(new RegExp(`\\s${at}=["']([^"']+)["']`, 'i'));
    const v = m && m[1].split(/\s+/)[0];
    if (v && !v.startsWith('data:')) return v;
  }
  return null;
}

function deCartoes(html, base) {
  const txt = decodificar(html.replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<img\b[^>]*>/gi, t => { const s = srcDaImg(t); return s ? `\u0004${s}\u0005` : ' '; })
    .replace(/<a\b[^>]*?href=["']([^"'#][^"']*)["'][^>]*>/gi, (_, h) => `\u0001${h}\u0002`).replace(/<\/a>/gi, '\u0003')
    .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(JUNTAR_NUM, '$1$2')
    .replace(new RegExp(`\\d+\\s*x\\s*(?:de\\s*)?${MOEDA}\\s*${NUM}|(?:economi[zs]e|poupe|desconto de|cashback de)\\s*:?\\s*${MOEDA}\\s*${NUM}`, 'gi'), ' ');
  const grupos = new Map();
  let link = null, fimLink = 0;
  const re = new RegExp(`\u0001([^\u0002]*)\u0002([^\u0003]*)\u0003?|${MOEDA}\\s*${NUM}`, 'g');
  let m;
  while ((m = re.exec(txt))) {
    if (m[1] != null) {
      // tira selos que as lojas colam no título do cartão ("Frete Grátis: Sul e Sudeste", "18% OFF", "13 UNID")
      const img = (m[2].match(/\u0004([^\u0005]+)\u0005/) || [])[1];
      const titulo = m[2].replace(/\u0004[^\u0005]*\u0005/g, ' ').replace(new RegExp(MOEDA + '\\s*' + NUM, 'g'), '')
        .replace(/frete gr[aá]tis(:\s*[a-zà-ú]+(\s+e\s+[a-zà-ú]+)?)?|\d+\s*%\s*off|\b\d+\s*unid(ades)?\b|pr[ée][\s-]?venda|oferta rel[âa]mpago|mais vendidos?|\bde\s+por\b|[àa] vista( no pix)?|no pix|\d+\s*x\s*sem juros|em estoque|cupom:?\s*[A-Z0-9]{4,}/gi, ' ')
        .replace(/\s+/g, ' ').trim();
      const url = absoluta(m[1], base);
      if (titulo.length >= 8 && /[a-zà-ú]{3}/i.test(titulo) && titulo.split(' ').length >= 2) {
        link = { url, nome: titulo.slice(0, 200), imagem: img ? absoluta(img, base) : (link?.url === url ? link.imagem : null) };
        fimLink = re.lastIndex;
      } else if (link?.url === url && img && !link.imagem) link.imagem = absoluta(img, base); // link só da foto, antes do título
      else if (!titulo && img) link = { url, nome: null, imagem: absoluta(img, base), soFoto: true };
      else if (titulo && link?.url !== url) link = null; // outro link qualquer: o cartão anterior acabou
      if (link?.soFoto) continue;
      const dentro = precosNoTexto(m[2]);
      if (link && dentro.length) dentro.forEach(p => (grupos.get(link.url) || grupos.set(link.url, { ...link, p: [] }).get(link.url)).p.push(p.p));
      continue;
    }
    const p = parsePreco(m[3], false);
    if (!p || !link || link.soFoto || m.index - fimLink > 700) continue;
    (grupos.get(link.url) || grupos.set(link.url, { ...link, p: [] }).get(link.url)).p.push(p);
  }
  return [...grupos.values()].map(g => {
    const preco = Math.min(...g.p), max = Math.max(...g.p);
    return { nome: g.nome, preco, precoDe: max > preco * 1.02 ? max : null, url: g.url, imagem: g.imagem || null, fonte: 'cartoes' };
  });
}

// ---------- download ----------
let navegadorCache;
function acharNavegador() {
  if (navegadorCache !== undefined) return navegadorCache;
  const c = [
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Microsoft/Edge/Application/msedge.exe'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Google/Chrome/Application/chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean).find(p => fs.existsSync(p));
  if (c) return (navegadorCache = c);
  for (const n of ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge']) {
    try { return (navegadorCache = execFileSync('which', [n], { encoding: 'utf8' }).trim()); } catch {}
  }
  return (navegadorCache = null);
}

async function baixarHttp(url) {
  const r = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(25000),
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
    },
  });
  return { status: r.status, html: await r.text(), url: r.url };
}

// Abre a página no Edge/Chrome invisível (DevTools Protocol) e pega o HTML depois do JavaScript rodar.
// Uma página por vez, pois todas usam o mesmo perfil.
let filaNavegador = Promise.resolve();
function baixarNavegador(url) {
  const p = filaNavegador.then(() => abrirNoNavegador(url));
  filaNavegador = p.catch(() => {});
  return p;
}

function matarArvore(proc) {
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => {});
  else proc.kill('SIGKILL');
}

async function abrirNoNavegador(url) {
  const exe = acharNavegador();
  if (!exe) throw new Error('Edge/Chrome não encontrado para páginas com JavaScript');
  const perfil = path.join(os.tmpdir(), 'monitor-precos-navegador');
  fs.mkdirSync(perfil, { recursive: true });
  try { fs.unlinkSync(path.join(perfil, 'DevToolsActivePort')); } catch {}
  const proc = spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio',
    '--disable-blink-features=AutomationControlled', `--user-data-dir=${perfil}`, `--user-agent=${UA}`, '--lang=pt-BR',
    '--remote-debugging-port=0', '--remote-allow-origins=*', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  const fim = Date.now() + 60000;
  let ws, navWs;
  try {
    let porta = null;
    while (!porta) {
      if (Date.now() > fim) throw new Error('navegador não abriu');
      try { porta = fs.readFileSync(path.join(perfil, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); } catch { await new Promise(r => setTimeout(r, 200)); }
    }
    const alvos = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json();
    const pagina = alvos.find(t => t.type === 'page');
    navWs = (await (await fetch(`http://127.0.0.1:${porta}/json/version`)).json()).webSocketDebuggerUrl;
    ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('falha ao conectar no navegador')); });
    let seq = 0;
    const pend = new Map(), eventos = [];
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method) eventos.push(m.method);
    };
    const cdp = (method, params = {}) => new Promise(res => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
    await cdp('Page.enable');
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})" });
    const nav = await cdp('Page.navigate', { url });
    if (nav.result?.errorText) throw new Error(nav.result.errorText);
    while (!eventos.includes('Page.loadEventFired') && Date.now() < fim - 15000) await new Promise(r => setTimeout(r, 250));
    await new Promise(r => setTimeout(r, 3500)); // tempo para preços carregados por JavaScript
    const r = await cdp('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
    const final = await cdp('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
    const html = r.result?.result?.value;
    if (!html) throw new Error('navegador não retornou a página');
    return { status: 200, html, url: final.result?.result?.value || url };
  } finally {
    try { ws?.close(); } catch {}
    try { // fecha o navegador inteiro, não só o processo inicial
      if (navWs) { const b = new WebSocket(navWs); b.onopen = () => b.send('{"id":1,"method":"Browser.close"}'); }
    } catch {}
    await new Promise(r => setTimeout(r, 1500));
    matarArvore(proc);
  }
}

const bloqueado = (r) => r.status === 403 || r.status === 429 || r.status === 503
  || /captcha|account-verification|challenge|\/gz\/|robot|blocked|perfdrive/i.test(r.url.replace(/[?#].*/, ''))
  || (r.html.length < 60000 && /captcha|are you a robot|access denied|robot check|verifique que você é humano|cf-chl|px-captcha/i.test(r.html));

// ---------- api ----------
function analisarHtml(html, base, { tipo = 'produto', regex } = {}) {
  const ld = deJsonLd(html, base), mt = deMeta(html, base), md = deMicrodata(html, base), js = deJsonEmbutido(html, base);
  const texto = textoVisivel(html);
  const pares = deParesDePor(texto);
  const titulo = meta(html, ['og:title', 'twitter:title']) || limpar((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]?.replace(/<[^>]+>/g, ''))
    || limpar((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);

  if (tipo === 'pagina') {
    // o mesmo produto pode vir do JSON-LD e do JSON embutido: junta pela URL e fica com o menor preço
    const porChave = new Map();
    for (const it of [...ld, ...js]) {
      if (!it.nome) continue;
      const k = it.url && it.url !== base ? it.url : '|' + it.nome;
      const j = porChave.get(k);
      if (!j) { porChave.set(k, { ...it }); continue; }
      const de = Math.max(j.precoDe || 0, it.precoDe || 0, j.preco, it.preco);
      j.preco = Math.min(j.preco, it.preco);
      j.precoDe = de > j.preco * 1.01 ? de : null;
      j.imagem ||= it.imagem;
      j.categoria ||= it.categoria;
    }
    let itens = [...porChave.values()];
    // se a maioria tem link próprio, os sem link são banners/campanhas
    if (itens.filter(i => i.url && i.url !== base).length > itens.length / 2) itens = itens.filter(i => i.url && i.url !== base);
    if (!itens.length) itens.push(...deCartoes(html, base));
    if (!itens.length) pares.forEach((p, n) => {
      const nome = texto.slice(Math.max(0, p.i - 90), p.i).split(/\s{2,}|\|/).pop().trim() || `item ${n + 1}`;
      itens.push({ nome, preco: p.por, precoDe: p.de, url: base, fonte: 'texto' });
    });
    return { titulo, itens: itens.slice(0, 300) };
  }

  let prod = null;
  if (regex) {
    const m = html.match(new RegExp(regex, 'i'));
    const p = m && parsePreco(m[1] ?? m[0], false);
    if (p) prod = { preco: p, precoDe: null, fonte: 'regex' };
  }
  if (!prod) {
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9à-ú]+/g, ' ').trim();
    const pagina = ld.find(i => i.url && base && i.url.split('?')[0] === base.split('?')[0]);
    const pareceTitulo = js.find(i => titulo && norm(titulo).includes(norm(i.nome).slice(0, 25)));
    prod = pagina || ld[0] || mt[0] || md[0] || pareceTitulo || null;
  }
  if (!prod && pares.length) prod = { preco: pares[0].por, precoDe: pares[0].de, fonte: 'texto' };
  if (!prod) {
    const ps = precosNoTexto(texto);
    const iTitulo = titulo ? texto.indexOf(titulo.slice(0, 30)) : -1;
    const p = ps.find(x => x.i > iTitulo) || ps[0];
    if (p) prod = { preco: p.p, precoDe: null, fonte: 'texto' };
  }
  if (!prod) return { titulo, produto: null };

  prod = { ...prod, nome: prod.nome || titulo, url: base };
  const perto = (a, b) => Math.abs(a - b) / b < 0.015;
  if (!prod.precoDe) {
    const outro = [...mt, ...js].find(i => i.precoDe && perto(i.preco, prod.preco)) || pares.find(p => perto(p.por, prod.preco));
    if (outro) prod.precoDe = outro.precoDe || outro.de;
  }
  if (prod.disponivel == null) prod.disponivel = mt[0]?.disponivel ?? (/(esgotado|indispon[ií]vel|out of stock|sold out|avise-me quando chegar)/i.test(texto.slice(0, 20000)) ? false : null);
  if (!prod.moeda) prod.moeda = mt[0]?.moeda || (/US\$|USD/.test(texto.slice(0, 5000)) ? 'USD' : 'BRL');

  // fontes estruturadas discordando muito costuma ser erro de cadastro
  const estruturados = [...ld.slice(0, 1), ...mt, ...md].map(i => i.preco);
  const max = Math.max(prod.preco, ...estruturados), min = Math.min(prod.preco, ...estruturados);
  if (estruturados.length && max / min >= 2) prod.divergencia = { min, max };
  return { titulo, produto: prod };
}

async function extrair(url, opcoes = {}) {
  const { navegador = null, navegadorAutomatico = true } = opcoes;
  let r = null, erro = null, erroNav = null;
  if (navegador !== true) {
    try { r = await baixarHttp(url); } catch (e) { erro = e; }
  }
  let res = r && !bloqueado(r) ? analisarHtml(r.html, r.url, opcoes) : null;
  const vazio = !res || (opcoes.tipo === 'pagina' ? !res.itens.length : !res.produto);
  if (vazio && (navegador === true || (navegador !== false && navegadorAutomatico && acharNavegador()))) {
    try {
      const rn = await baixarNavegador(url);
      res = analisarHtml(rn.html, rn.url, opcoes);
      res.viaNavegador = true;
    } catch (e) { erroNav = e; erro = erro || e; }
  }
  if (!res) {
    if (r && bloqueado(r)) throw new Error(`site bloqueou o acesso (HTTP ${r.status}${r.status === 200 ? ', captcha' : ''})${erroNav ? '; navegador: ' + erroNav.message : ''}`);
    throw new Error(erro ? erro.message : `HTTP ${r?.status}`);
  }
  if (r && !res.viaNavegador && r.status >= 400) res.aviso = `HTTP ${r.status}`;
  return res;
}

module.exports = { extrair, analisarHtml, parsePreco, baixarHttp, baixarNavegador, decodificar, limpar, precosNoTexto, deParesDePor, acharNavegador };
