// Service worker: rede primeiro (pega atualizacoes), cache como reserva offline
const CACHE = 'pandafit-v9';
const ARQUIVOS = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'exercicios.js', 'alimentos.js', 'nucleo.js', 'treino.js', 'jejum.js', 'dieta.js', 'leitor.js', 'corpo.js', 'inicio.js', 'nuvem.js', 'firebase-config.js', 'app.js',
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

// De outros sites so guarda as fotos dos exercicios e a biblioteca do Firebase; as chamadas da nuvem passam direto
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin && !/(^|\.)(githubusercontent\.com|gstatic\.com)$/.test(url.hostname)) return;
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
