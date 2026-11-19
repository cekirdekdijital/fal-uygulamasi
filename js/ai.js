// Yorum isteği. Üç çalışma modu:
// 1) Sunucu modu: CONFIG.API_URL doluysa yorum Cloudflare Worker üzerinden Claude'dan gelir (gerçek uygulama).
// 2) Önizleme modu: uygulama claude.ai içinde açıldıysa, görüntüleyenin Claude hesabıyla yorum üretilir (test için).
// 3) Demo modu: ikisi de yoksa, yorum kart verisinden örnek olarak oluşturulur (yapay zekâ yok).
import { CONFIG } from "../app.config.js";
import { KATMANLAR } from "../shared/katmanlar.js";
import { buildPrompt } from "../shared/prompt.js";
import { POS } from "../shared/motor.js";
import { store, zamanAnahtarlari } from "./store.js";

let samplePromise = null;
function getSample() {
  if (!samplePromise) samplePromise = (window.claude?.use ? window.claude.use("sample") : Promise.resolve(null)).catch(() => null);
  return samplePromise;
}
export async function calismaModu() {
  if (CONFIG.API_URL) return "sunucu";
  return (await getSample()) ? "onizleme" : "demo";
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
      const r = await fetch(`${CONFIG.API_URL}/api/hak?cihaz=${encodeURIComponent(store.cihaz())}&kod=${encodeURIComponent(store.kod())}`);
      if (r.ok) { const j = await r.json(); store.setKatman(j.katman); return j; }
    } catch {}
    return { ...yerelHak(store.katman()), katman: store.katman(), cevrimdisi: true };
  }
  return { ...yerelHak(store.katman()), katman: store.katman() };
}

/* ---------- Okuma isteği ---------- */
export class OkumaHatasi extends Error { constructor(kod, mesaj) { super(mesaj); this.kod = kod; } }

export async function okumaIste({ D, A, profil, picks, mod, onText, signal }) {
  const calisma = await calismaModu();
  const P = { burc: profil.burc, yk: profil.yk, niyet: profil.niyet, soru: profil.soru };

  if (calisma === "sunucu") {
    const r = await fetch(`${CONFIG.API_URL}/api/okuma`, {
      method: "POST", signal, headers: { "content-type": "application/json" },
      body: JSON.stringify({ cihaz: store.cihaz(), kod: store.kod(), profil: P, picks, mod }),
    });
    if (!r.ok) { let j = {}; try { j = await r.json(); } catch {} throw new OkumaHatasi(j.kod || "sunucu", j.mesaj || "Sunucuya ulaşılamadı."); }
    const reader = r.body.getReader(); const dec = new TextDecoder(); let text = "";
    for (;;) { const { done, value } = await reader.read(); if (done) break; text += dec.decode(value, { stream: true }); onText(text); }
    return { text, mod: r.headers.get("x-mod") || mod };
  }

  const kalan = yerelHak(store.katman());
  if (kalan.gunKalan <= 0 || kalan.haftaKalan <= 0) throw new OkumaHatasi("hak_bitti", "Bu dönem için okuma hakkın doldu.");
  if (mod === "derin" && store.katman() !== "premiumPlus" && kalan.derinKalan <= 0) mod = KATMANLAR[store.katman()].okuma;

  if (calisma === "onizleme") {
    const sample = await getSample(); const pr = buildPrompt(D, A, P, mod);
    try {
      const { text } = await sample(pr.system + "\n\n---\n\n" + pr.user, { signal, cache: false, modelTier: mod === "derin" ? "default" : "quick", onText: ({ text }) => onText(text) });
      yerelHakKullan(mod === "derin"); return { text, mod };
    } catch (e) {
      if (e?.code === "cancelled") throw new OkumaHatasi("iptal", "Durduruldu.");
      throw new OkumaHatasi(e?.code || "hata", e?.code === "not_granted" ? "Önizlemede yapay zekâ izni verilmedi; demo yorum gösteriliyor." : "Yorum alınamadı.");
    }
  }

  // demo
  const text = demoYorum(D, A, mod); let out = "";
  for (const parca of text.match(/[\s\S]{1,24}/g)) {
    if (signal?.aborted) throw new OkumaHatasi("iptal", "Durduruldu.");
    out += parca; onText(out); await new Promise(r => setTimeout(r, 18));
  }
  yerelHakKullan(mod === "derin"); return { text: out, mod, demo: true };
}

export function demoYorum(D, A, mod) {
  const SET = Object.fromEntries(D.sets.map(s => [s.id, s]));
  const L = [`# Demo Okuma`, `_Bu metin yapay zekâ olmadan, kart verisinden örnek olarak oluşturuldu. Sunucu bağlandığında gerçek yorum gelecek._`,
    `Okumanın enerjisi: ${A.enerji.toLowerCase()}.`];
  A.cs.forEach((c, i) => {
    const pz = c.poz[POS[i].ad] || {};
    L.push(`## ${i + 1}. ${POS[i].ad}: ${c.ad} (${c.o === "D" ? "Dikey" : "Yatay"})`,
      `${c.o === "D" ? pz.D : pz.Y} ${SET[c.set].mitoloji} anlatısında ${c.mitFigur[0]} bunu hatırlatır: ${c.mitDers}`);
  });
  if (mod !== "kisa" && A.kopru.length) L.push(`## Mitolojik Köprüler`, A.kopru.map(k => `${D.motifler[k.m]}: ${k.l.map(c => c.ad).join(", ")}.`).join(" "));
  L.push(`## Kapanış`, `Kök'teki ${A.cs[0].ad} ile Kader'deki ${A.cs[5].ad} arasındaki yolu kendi adımlarınla yürüyorsun.`, `_Bu okuma eğlence ve kişisel farkındalık amaçlıdır._`);
  return L.join("\n\n");
}
