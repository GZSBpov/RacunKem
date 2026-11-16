// RacunKem - delovanje brez interneta. Ob spremembi datotek povečaj RAZLICICA.
const RAZLICICA = 'racunkem-2';
const DATOTEKE = ['./', 'index.html', 'alloyMath.js', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
    e.waitUntil(caches.open(RAZLICICA).then(function (c) { return c.addAll(DATOTEKE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
    e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (i) { return i !== RAZLICICA; }).map(function (i) { return caches.delete(i); })); }).then(function () { return self.clients.claim(); }));
});
// najprej omrežje (da pride nova različica), brez povezave iz shrambe
self.addEventListener('fetch', function (e) {
    if (e.request.method !== 'GET') return;
    e.respondWith(fetch(e.request).then(function (odgovor) {
        const kopija = odgovor.clone();
        if (odgovor.ok) caches.open(RAZLICICA).then(function (c) { c.put(e.request, kopija); });
        return odgovor;
    }).catch(function () { return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); }); }));
});
