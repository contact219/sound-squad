// Offline support: try the network first, fall back to the saved copy.
const CACHE = 'soundsquad-v4';
const SHELL = [
  './', 'index.html', 'css/app.css', 'icon.svg', 'manifest.webmanifest',
  'js/app.js', 'js/data.js', 'js/store.js', 'js/speech.js', 'js/ui.js', 'js/coach.js', 'js/checkpoint.js', 'js/read-anything.js',
  'js/act-ran.js', 'js/act-letters.js', 'js/act-phon.js', 'js/act-spell.js', 'js/act-memory.js', 'js/act-read.js',
  'js/act-decode.js', 'js/act-write.js', 'js/act-math.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && (new URL(e.request.url).origin === location.origin || e.request.url.includes('fonts.g'))) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))),
  );
});
