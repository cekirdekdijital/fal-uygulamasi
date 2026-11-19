// Okuma motoru: astroloji, element ilişkileri, kart bağları ve mitolojik köprüler.
// Tarayıcıda ve sunucuda aynı şekilde çalışır (DOM kullanmaz).

export const POS = [
  { ad: "Kök",      soru: "Bu durum nereden geliyor?" },
  { ad: "Şimdi",    soru: "Şu an hangi enerjinin içindesin?" },
  { ad: "Sınav",    soru: "Önündeki engel ya da ders ne?" },
  { ad: "Yardımcı", soru: "Sana hangi güç destek oluyor?" },
  { ad: "Yol",      soru: "Yakın gelecekte ne açılıyor?" },
  { ad: "Kader",    soru: "Bu yolculuk nereye varıyor?" },
];

// [burç, başlangıç ayı, günü, element, yönetici gezegen]
export const SIGNS = [
  ["Koç", 3, 21, "Ateş", "Mars"], ["Boğa", 4, 20, "Toprak", "Venüs"], ["İkizler", 5, 21, "Hava", "Merkür"],
  ["Yengeç", 6, 21, "Su", "Ay"], ["Aslan", 7, 23, "Ateş", "Güneş"], ["Başak", 8, 23, "Toprak", "Merkür"],
  ["Terazi", 9, 23, "Hava", "Venüs"], ["Akrep", 10, 23, "Su", "Plüton"], ["Yay", 11, 22, "Ateş", "Jüpiter"],
  ["Oğlak", 12, 22, "Toprak", "Satürn"], ["Kova", 1, 20, "Hava", "Uranüs"], ["Balık", 2, 19, "Su", "Neptün"],
];
export const SIGN = Object.fromEntries(SIGNS.map(s => [s[0], { el: s[3], yon: s[4] }]));

export const TAGS = {
  uyanis: "Uyanış", kirilma: "Kırılma / ani değişim", denge: "Denge / uyum", sabir: "Sabır / olgunlaşma",
  sezgi: "Sezgi", hafiza: "Hafıza / geçmiş", yeniden: "Yeniden doğuş", ozgurluk: "Özgürleşme",
  hakikat: "Hakikat / yüzleşme", aidiyet: "Aidiyet / bağ", cesaret: "Cesaret / eylem", bilgelik: "Bilgelik / rehberlik",
  duzen: "Düzen / sorumluluk / kontrol", tutunma: "Tutunma / muhafaza", golge: "Gölge / bastırılmış",
  ozdeger: "Öz değer / iç güç", aldanis: "Aldanış / belirsizlik", dongu: "Döngü / zaman", sefkat: "Şefkat / ihtiyaç", hirs: "Hırs / güç",
};
export const NIYET = { genel: "Genel", iliski: "Aşk ve ilişkiler", yol: "İş, karar ve yol", ic: "Kendini tanıma" };

/** Doğum tarihinden (YYYY-AA-GG) güneş burcu. */
export function sunSign(iso) {
  if (!iso) return null;
  const [, m, d] = String(iso).split("-").map(Number);
  if (!m || !d) return null;
  const md = m * 100 + d;
  const order = [...SIGNS].sort((a, b) => (a[1] * 100 + a[2]) - (b[1] * 100 + b[2]));
  let r = "Oğlak";
  for (const s of order) if (md >= s[1] * 100 + s[2]) r = s[0];
  return r;
}

export function elRel(a, b) {
  if (a === b) return { k: "ayni", ad: "Aynı element: güçlenir", p: 2 };
  const s = [a, b].sort().join("+");
  if (s === "Ateş+Hava" || s === "Su+Toprak") return { k: "uyum", ad: "Uyumlu: destekler", p: 1 };
  if (s === "Ateş+Su" || s === "Hava+Toprak") return { k: "gerilim", ad: "Gerilimli: ders", p: -1 };
  return { k: "notr", ad: "Nötr", p: 0 };
}

export function userRel(card, P) {
  if (!P || !P.burc || !SIGN[P.burc]) return { score: 0, label: "Nötr", detay: [] };
  const sun = SIGN[P.burc]; const out = []; let score = 0;
  if (card.burc === P.burc) { out.push("Güneş burcunla aynı: rezonans"); score += 3; }
  if (card.gezegen === sun.yon) { out.push(`Burcunun yöneticisi ${sun.yon}`); score += 2; }
  if (P.yk && card.burc === P.yk) { out.push("Yükselenle aynı burç"); score += 2; }
  const er = elRel(card.element, sun.el); score += er.p;
  out.push(`${card.element} ↔ ${sun.el}: ${er.ad.toLowerCase()}`);
  const label = score >= 3 ? "Güçlü rezonans" : score >= 1 ? "Destekleyici" : score < 0 ? "Sürtünme / ders" : "Nötr";
  const lvl = score >= 3 ? "strong" : score >= 1 ? "good" : score < 0 ? "warn" : "";
  return { score, label, lvl, detay: out };
}

const inter = (a, b) => a.filter(x => b.includes(x));
export function pairRel(A, B) {
  return {
    e: elRel(A.element, B.element),
    sup: [...new Set([...inter(B.tema, A.destek), ...inter(A.tema, B.destek)])],
    ten: [...new Set([...inter(B.tema, A.gerilim), ...inter(A.tema, B.gerilim)])],
  };
}

/** Bir okumanın tüm çıkarımları. picks: [{kod, o:"D"|"Y"}] */
export function analyze(D, picks, P) {
  const byKod = Object.fromEntries(D.cards.map(c => [c.kod, c]));
  const cs = picks.map((p, i) => ({ ...byKod[p.kod], o: p.o, i }));
  const dik = cs.filter(c => c.o === "D").length;
  const elc = { Ateş: 0, Su: 0, Hava: 0, Toprak: 0 }; cs.forEach(c => elc[c.element]++);
  const setc = {}; cs.forEach(c => setc[c.set] = (setc[c.set] || 0) + 1);
  const temc = {}; cs.forEach(c => c.tema.forEach(t => temc[t] = (temc[t] || 0) + 1));
  const anaTema = Object.entries(temc).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([t, n]) => ({ t, n }));
  const domEl = Object.entries(elc).sort((a, b) => b[1] - a[1])[0];
  const missing = Object.entries(elc).filter(([, n]) => !n).map(([e]) => e);
  const domSet = Object.entries(setc).sort((a, b) => b[1] - a[1])[0];
  const pairs = cs.slice(1).map((c, i) => ({ a: cs[i], b: c, ...pairRel(cs[i], c) }));
  const urel = cs.map(c => userRel(c, P));
  const mot = {}; cs.forEach(c => c.motif.forEach(m => (mot[m] ??= []).push(c)));
  const kopru = Object.entries(mot).filter(([, l]) => new Set(l.map(c => c.set)).size >= 2)
    .map(([m, l]) => ({ m, l })).sort((a, b) => b.l.length - a.l.length);
  const setler = [...new Set(cs.map(c => c.set))];
  const enerji = dik >= 4 ? "Dışa dönük: olaylar hareket hâlinde, eylem çağrısı baskın"
    : dik <= 2 ? "İçe dönük: hazırlık, olgunlaşma ve fark etme dönemi"
    : "Dengeli: açık ve bekleyen enerjiler yarı yarıya";
  return { cs, dik, elc, setc, anaTema, domEl, missing, domSet, pairs, urel, kopru, setler, enerji };
}

/** İstemciden gelen seçimleri doğrular. Geçersizse hata metni döner. */
export function validatePicks(D, picks) {
  if (!Array.isArray(picks) || picks.length !== 6) return "Altı kart seçilmeli.";
  const kods = new Set(D.cards.map(c => c.kod)); const seen = new Set();
  for (const p of picks) {
    if (!p || !kods.has(p.kod)) return "Geçersiz kart.";
    if (p.o !== "D" && p.o !== "Y") return "Geçersiz konum.";
    if (seen.has(p.kod)) return "Aynı kart iki kez seçilemez.";
    seen.add(p.kod);
  }
  return null;
}
