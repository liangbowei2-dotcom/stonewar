// Service worker:讓遊戲離線也能開。
// 有網路時一律抓最新的檔案並更新快取,沒網路才用快取,所以重新上傳檔案後手機下次開啟就會更新。
const CACHE = 'stonewar-v1';
const FILES = [
  './', 'index.html', 'manifest.json',
  'js/art.js', 'js/levels.js', 'js/game.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
      return res;
    }).catch(function () {
      // 離線:網址帶 ?level=3 之類的參數時也要找得到快取的頁面
      return caches.match(e.request, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('index.html'); });
    })
  );
});
