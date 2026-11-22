// Yorum isteği. Üç çalışma modu:
// 1) Sunucu modu: CONFIG.API_URL doluysa yorum Cloudflare Worker üzerinden Claude'dan gelir (gerçek uygulama).
// 2) Önizleme modu: uygulama claude.ai içinde açıldıysa, görüntüleyenin Claude hesabıyla yorum üretilir (test için).
// 3) Demo modu: ikisi de yoksa, yorum kart verisinden örnek olarak oluşturulur (yapay zekâ yok).
import { CONFIG } from "../app.config.js";
import { KATMANLAR } from "../shared/katmanlar.js";
import { buildPrompt } from "../shared/prompt.js";
import { POS } from "../shared/motor.js";
import { store, zamanAnahtarlari } from "./store.js";
import { t, tv } from "./i18n.js";
import { kimlikBelgesi } from "./hesap.js";

const baslik = async (ek = {}) => { const k = await kimlikBelgesi(); return k ? { ...ek, authorization: "Bearer " + k } : ek; };

// Ücretsiz planda okuma öncesi ödüllü reklam. Android sürümünde reklam eklentisi window.LogosReklam.goster() sağlar.
// Eklenti yoksa (web sürümü) okuma doğrudan açılır.
export async function reklamOncesi(katman) {
  if (!KATMANLAR[katman]?.reklam || !window.LogosReklam?.goster) return true;
  try { return !!(await window.LogosReklam.goster()); } catch { return false; }
}

let samplePromise = null;
function getSample() {
  if (!samplePromise) samplePromise = (window.claude?.use ? window.claude.use("sample") : Promise.resolve(null)).catch(() => null);
  return samplePromise;
}
export async function calismaModu() {
  if (CONFIG.API_URL) return "sunucu";
  return (await getSample()) ? "onizleme" : "demo";
}

/* ---------- Bölge, bekleme listesi, içerik bildirimi (yalnızca sunucu modunda) ---------- */
// Hizmet yalnızca izin verilen ülkelerde (şimdilik Türkiye) açıktır. Geliştirici görünümünde ?bolge=dis ile ekran denenebilir.
export async function bolgeDurumu() {
  if (CONFIG.GELISTIRICI && new URLSearchParams(location.search).get("bolge") === "dis") return { izinli: false, ulke: "DE", deneme: true };
  if ((await calismaModu()) !== "sunucu") return { izinli: true };
  try { const r = await fetch(`${CONFIG.API_URL}/api/bolge`); if (r.ok) return await r.json(); } catch {}
  return { izinli: true, bilinmiyor: true }; // bağlantı yoksa engelleme; sunucu her istekte ayrıca denetler
}
export async function beklemeKaydet(eposta, dil) {
  if ((await calismaModu()) !== "sunucu") return { tamam: true, deneme: true };
  const r = await fetch(`${CONFIG.API_URL}/api/bekleme`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eposta, dil, onay: true, onaySurum: "1" }) });
  return r.ok ? { tamam: true } : { tamam: false, kod: (await r.json().catch(() => ({}))).kod || "hata" };
}
export async function bildirGonder(kayit) {
  if ((await calismaModu()) !== "sunucu") return { tamam: true, deneme: true };
  const r = await fetch(`${CONFIG.API_URL}/api/bildir`, { method: "POST", headers: await baslik({ "content-type": "application/json" }), body: JSON.stringify({ cihaz: store.cihaz(), ...kayit }) });
  return r.ok ? { tamam: true } : { tamam: false };
}

/* ---------- Hak sayacı (sunucu yoksa cihazda tutulur) ---------- */
export function yerelHak(katmanId) {
  const k = KATMANLAR[katmanId]; const z = zamanAnahtarlari(); const h = store.hak();
  const gun = h.gun === z.gun ? h.gn || 0 : 0, hafta = h.hafta === z.hafta ? h.hn || 0 : 0, ay = h.ay === z.ay ? h.dn || 0 : 0;
  return { gunKalan: Math.max(0, k.gunluk - gun), haftaKalan: Math.max(0, k.haftalik - hafta), derinKalan: Math.max(0, k.derinAylik - ay), gunluk: k.gunluk, haftalik: k.haftalik, derinAylik: k.derinAylik };
}
function yerelHakKullan(derin) {
  const z = zamanAnahtarlari(); const h = store.hak();
  const n = { gun: z.gun, hafta: z.hafta, ay: z.ay,
    gn: (h.gun === z.gun ? h.gn || 0 : 0) + 1, hn: (h.hafta === z.hafta ? h.hn || 0 : 0) + 1, dn: (h.ay === z.ay ? h.dn || 0 : 0) + (derin ? 1 : 0) };
  store.setHak(n);
}

export async function hakDurumu() {
  const mod = await calismaModu();
  if (mod === "sunucu") {
    try {
      const r = await fetch(`${CONFIG.API_URL}/api/hak?cihaz=${encodeURIComponent(store.cihaz())}&kod=${encodeURIComponent(store.kod())}`, { headers: await baslik() });
      if (r.ok) { const j = await r.json(); store.setKatman(j.katman); return j; }
      if (r.status === 451) return { ...yerelHak("ucretsiz"), gunKalan: 0, katman: store.katman(), bolge: true };
    } catch {}
    return { ...yerelHak(store.katman()), katman: store.katman(), cevrimdisi: true };
  }
  return { ...yerelHak(store.katman()), katman: store.katman() };
}

/* ---------- Okuma isteği ---------- */
export class OkumaHatasi extends Error { constructor(kod, mesaj) { super(mesaj); this.kod = kod; } }

// D, A: Türkçe deste ve analiz (istem için) · Dy, Ay: seçili dildeki görüntüleme destesi ve analiz (demo için)
export async function okumaIste({ D, A, Dy = D, Ay = A, dil = "tr", yerel = null, profil, picks, mod, onText, signal }) {
  const calisma = await calismaModu();
  const P = { burc: profil.burc, yk: profil.yk, niyet: profil.niyet, soru: profil.soru };

  if (calisma === "sunucu") {
    const r = await fetch(`${CONFIG.API_URL}/api/okuma`, {
      method: "POST", signal, headers: await baslik({ "content-type": "application/json" }),
      body: JSON.stringify({ cihaz: store.cihaz(), kod: store.kod(), profil: P, picks, mod, dil }),
    });
    if (!r.ok) { let j = {}; try { j = await r.json(); } catch {} throw new OkumaHatasi(j.kod || "sunucu", j.kod && t("hata." + j.kod) !== "hata." + j.kod ? t("hata." + j.kod) : j.mesaj || t("hata.sunucu")); }
    const reader = r.body.getReader(); const dec = new TextDecoder(); let text = "";
    for (;;) { const { done, value } = await reader.read(); if (done) break; text += dec.decode(value, { stream: true }); if (!text.includes("\u0001")) onText(text); }
    const hi = text.indexOf("\u0001HATA:");
    if (hi >= 0 || !text.trim()) { const neden = hi >= 0 ? text.slice(hi + 6).trim() : "bos"; console.warn("Logos yorum hatası:", neden); throw new OkumaHatasi("yz_hata", `${t("hata.yz_hata")} (${neden})`); }
    return { text, mod: r.headers.get("x-mod") || mod };
  }

  const kalan = yerelHak(store.katman());
  if (kalan.gunKalan <= 0 || kalan.haftaKalan <= 0) throw new OkumaHatasi("hak_bitti", t("hata.hak_bitti"));
  const kk = KATMANLAR[store.katman()];
  if (mod === "derin" && kalan.derinKalan <= 0) mod = kk.okuma === "derin" ? "tam" : kk.okuma;

  if (calisma === "onizleme") {
    const sample = await getSample(); const pr = buildPrompt(D, A, P, mod, yerel);
    try {
      const { text } = await sample(pr.system + "\n\n---\n\n" + pr.user, { signal, cache: false, modelTier: mod === "derin" ? "default" : "quick", onText: ({ text }) => onText(text) });
      yerelHakKullan(mod === "derin"); return { text, mod };
    } catch (e) {
      if (e?.code === "cancelled") throw new OkumaHatasi("iptal", t("hata.iptal"));
      throw new OkumaHatasi(e?.code || "hata", e?.code === "not_granted" ? t("hata.izin") : t("hata.genel"));
    }
  }

  // demo
  const text = demoYorum(Dy, Ay, mod); let out = "";
  for (const parca of text.match(/[\s\S]{1,24}/g)) {
    if (signal?.aborted) throw new OkumaHatasi("iptal", t("hata.iptal"));
    out += parca; onText(out); await new Promise(r => setTimeout(r, 18));
  }
  yerelHakKullan(mod === "derin"); return { text: out, mod, demo: true };
}

export function demoYorum(D, A, mod) {
  const mit = id => t(`mit.${id}`), pos = i => t(`pos.${i}.ad`), konum = o => t(`konum.${o}`);
  const L = [`# ${t("demo.baslik")}`, `_${t("demo.not")}_`, t("demo.enerji", { e: t("enerji." + (A.dik >= 4 ? "dis" : A.dik <= 2 ? "ic" : "denge")) })];
  A.cs.forEach((c, i) => {
    const pz = c.poz?.[POS[i].ad] || {}; const metin = c.o === "D" ? pz.D : pz.Y;
    const anahtar = c.o === "D" ? c.dAnahtar : c.yAnahtar;
    L.push(`## ${i + 1}. ${pos(i)}: ${c.ad} (${konum(c.o)})`,
      metin ? `${metin} ${c.mitDers ? t("demo.mit", { m: mit(c.set), f: c.mitFigur[0], d: c.mitDers }) : ""}` : t("demo.kisaKart", { a: anahtar, m: mit(c.set), f: c.mitFigur[0] }));
  });
  if (mod !== "kisa" && A.kopru.length) L.push(`## ${t("istem.kopru")}`, A.kopru.map(k => `${tv("motif", k.m)}: ${k.l.map(c => c.ad).join(", ")}.`).join(" "));
  L.push(`## ${t("istem.kapanis")}`, t("demo.kapanis", { a: A.cs[0].ad, b: A.cs[5].ad, p1: pos(0), p2: pos(5) }));
  return L.join("\n\n");
}
