import { katmanId } from "../shared/katmanlar.js";
// Cihazda saklanan veriler: profil, okuma geçmişi, yerel hak sayacı.
// Not: Bu veriler yalnızca bu cihazdadır. Uygulama silinirse ya da tarayıcı verisi temizlenirse kaybolur.

const K = { profil: "fal.profil", gecmis: "fal.gecmis", hak: "fal.hak", cihaz: "fal.cihaz", katman: "fal.katman", kod: "fal.kod", bitis: "fal.bitis" };
const get = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export const store = {
  profil: () => get(K.profil, null),
  setProfil: p => set(K.profil, p),
  gecmis: () => get(K.gecmis, []),
  addGecmis: r => { const g = get(K.gecmis, []); g.unshift(r); set(K.gecmis, g.slice(0, 40)); },
  updateGecmis: (id, patch) => { const g = get(K.gecmis, []); const i = g.findIndex(x => x.id === id); if (i >= 0) { g[i] = { ...g[i], ...patch }; set(K.gecmis, g); } },
  cihaz: () => { let c = get(K.cihaz, null); if (!c) { c = (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now()); set(K.cihaz, c); } return c; },
  katman: () => katmanId(get(K.katman, "ucretsiz")),
  setKatman: k => set(K.katman, k),
  kod: () => get(K.kod, ""),
  setKod: k => set(K.kod, k),
  bitis: () => get(K.bitis, null),
  setBitis: b => set(K.bitis, b || null),
  hak: () => get(K.hak, {}),
  setHak: h => set(K.hak, h),
  hepsiniSil: () => { try { Object.values(K).forEach(k => localStorage.removeItem(k)); } catch {} },
};

// Geliştirici görünümü: app.config.js GELISTIRICI ya da bu cihazda adrese bir kez ?gelistirici=ac eklenerek açılır (?gelistirici=kapat ile kapanır).
// Son kullanıcılar bu görünümü görmez; sunucu tam erişimi yalnızca gizli kodla verir.
let GEL = null;
export function gelistiriciAcik(varsayilan) {
  if (GEL !== null) return GEL;
  try {
    const q = new URLSearchParams(location.search).get("gelistirici");
    if (q === "ac") localStorage.setItem("logos.gelistirici", "1");
    if (q === "kapat") localStorage.removeItem("logos.gelistirici");
    GEL = !!varsayilan || localStorage.getItem("logos.gelistirici") === "1";
  } catch { GEL = !!varsayilan; }
  return GEL;
}

// İstanbul saatine göre gün, hafta ve ay anahtarları
export function zamanAnahtarlari(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d).map(x => [x.type, x.value]));
  const gun = `${p.year}-${p.month}-${p.day}`;
  const t = new Date(Date.UTC(+p.year, +p.month - 1, +p.day));
  const wd = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - wd + 3);
  const y1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const hafta = `${t.getUTCFullYear()}-H${String(1 + Math.round(((t - y1) / 864e5 - 3 + ((y1.getUTCDay() + 6) % 7)) / 7)).padStart(2, "0")}`;
  return { gun, hafta, ay: `${p.year}-${p.month}` };
}
