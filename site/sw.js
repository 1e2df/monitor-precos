// Service worker do app: guarda a "casca" (HTML, CSS, JS, ícones) para abrir rápido e sem rede.
// Os dados da API nunca vão para o cache: preço velho é pior que nenhum.
const CACHE = 'monitor-casca-v2';
const CASCA = ['./', 'index.html', 'app.js', 'estilo.css', 'manifest.webmanifest', 'icone-192.png', 'icone-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CASCA)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// rede primeiro (para pegar versões novas do site); sem rede, a cópia guardada
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
