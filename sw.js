// Service worker: rede primeiro (pega atualizacoes), cache como reserva offline
const CACHE = 'pandafit-v3';
const ARQUIVOS = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'exercicios.js', 'alimentos.js', 'nucleo.js', 'treino.js', 'jejum.js', 'dieta.js', 'corpo.js', 'inicio.js', 'app.js',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(ARQUIVOS.map((a) => c.add(a)))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// As fotos dos exercicios (outro site) entram no cache conforme sao vistas
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const copia = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
