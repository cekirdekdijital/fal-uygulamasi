// Çevrimdışı önbellek. Dosyaları güncellediğinizde SURUM değerini değiştirin.
const SURUM = "fal-0.8.0";
const CEKIRDEK = ["./", "index.html", "app.config.js", "css/app.css", "js/app.js", "js/ai.js", "js/store.js", "js/fx.js", "js/koruyucu.js", "js/i18n.js", "js/hesap.js", "shared/diller.js", "i18n/tr.json",
  "shared/motor.js", "shared/prompt.js", "shared/katmanlar.js", "data/deste.json", "manifest.webmanifest", "assets/icons/icon-192.png", "assets/ui/logo.webp",
  ...["S1", "S2", "S3", "S4", "S5", "S6"].map(s => `assets/ui/koruyucular/G-${s}.webp`)];
self.addEventListener("install", e => { e.waitUntil(caches.open(SURUM).then(c => c.addAll(CEKIRDEK)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SURUM).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin || u.pathname.includes("/api/")) return; // dış adresler (Firebase, sunucu) önbelleğe alınmaz
  // Kod ve veri: önce ağ (güncel kalsın), olmazsa önbellek. Görseller: önce önbellek.
  const gorsel = /\.(webp|png|jpg|jpeg|mp4|webm)$/i.test(u.pathname);
  e.respondWith(gorsel
    ? caches.match(e.request).then(r => r || fetch(e.request).then(res => { const c = res.clone(); caches.open(SURUM).then(x => x.put(e.request, c)); return res; }))
    : fetch(e.request).then(res => { const c = res.clone(); caches.open(SURUM).then(x => x.put(e.request, c)); return res; }).catch(() => caches.match(e.request)));
});
