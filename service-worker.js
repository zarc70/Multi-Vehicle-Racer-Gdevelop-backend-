const CACHE_NAME = "multi-vehicle-racer-v052";
const ASSETS = [
  "./assets/overlays/dirt/dirt_01.png",
  "./assets/overlays/dirt/dirt_02.png",
  "./assets/overlays/dirt/dirt_03.png",
  "./assets/overlays/dirt/dirt_04.png",
  "./assets/overlays/dirt/dirt_05.png",
  "./assets/overlays/dirt/dirt_06.png",
  "./assets/overlays/dirt/dirt_07.png",
  "./assets/overlays/dirt/dirt_08.png",
  "./assets/overlays/dirt/dirt_09.png",
  "./assets/overlays/dirt/dirt_10.png",
  "./assets/overlays/dirt/dirt_11.png",
  "./assets/overlays/dirt/dirt_12.png",
  "./assets/overlays/leaves/leaves_01.png",
  "./assets/overlays/leaves/leaves_02.png",
  "./assets/overlays/leaves/leaves_03.png",
  "./assets/overlays/leaves/leaves_04.png",
  "./assets/overlays/leaves/leaves_05.png",
  "./assets/overlays/leaves/leaves_06.png",
  "./assets/overlays/leaves/leaves_07.png",
  "./assets/overlays/leaves/leaves_08.png",
  "./assets/overlays/leaves/leaves_09.png",
  "./assets/overlays/leaves/leaves_10.png",
  "./assets/overlays/leaves/leaves_11.png",
  "./assets/overlays/leaves/leaves_12.png",
  "./assets/tracks/clean_oval_track.jpg",
  "./assets/vehicles/street_sweeper_4brush_right.png",
  "./game.js",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./index.html",
  "./manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
