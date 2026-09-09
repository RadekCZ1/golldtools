/* XAU INTEL — service worker
   Záměrně NETWORK-FIRST. Klasická past PWA je cache-first: aplikace se pak
   nikdy neaktualizuje a u obchodního nástroje by navíc servírovala stará data.
   Cache je tu jen jako záchrana, když je telefon offline.
   Tržní data se necachují VŮBEC — od toho je živý feed. */
const CACHE = 'xauintel-v6';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Cizí původ = tržní data (Binance, brány). Nikdy necachovat, nikdy nesahat.
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
