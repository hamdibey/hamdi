/* veradekorasyon.store — basit uygulama kabuk service worker'ı */
const CACHE = "veradek-v3"; // v3: /api istekleri asla önbelleğe alınmaz (PHP proxy dönemi)
const SHELL = ["./", "./index.html", "./icon-192.png", "./icon-512.png", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
  );
});

// Ana sayfa "SKIP_WAITING" gönderirse hemen devralsaın (otomatik güncelleme akışı)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      // Yeni sürüm kurulduysa açık sekmeleri hemen yenile — kullanıcı "eski sürüm" görmesin
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => clients.forEach((c) => c.navigate(c.url)))
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // uzak kaynaklar bypass
  // API (PHP reverse-proxy /api/public/*) ASLA önbelleğe alınmaz — canlı veridir
  if (url.pathname.startsWith("/api/")) return;

  // Sayfa AÇILIŞLARI ve uygulama kabuğu: her zaman AĞ ÖNCE — eski index.html asla gösterilmesin;
  // kopuksa önbellekteki son sürüm. (Kullanıcının "olmuyor" şikâyetinin kök nedeni buydu.)
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put("./index.html", copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Statik dosyalar: ağ öncelikli, başarısızsa önbellek (eski tek-dosya build'de neredeyse hiç yok)
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
