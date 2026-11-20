// Dil desteği: arayüz metinleri (i18n/xx.json), kart çevirileri (data/kartlar/xx.json), yön ve yazı tipi.
// Metinde bulunmayan anahtar önce Türkçeden alınır. Kart çevirisinde eksik uzun metin Türkçe gösterilmez; "çeviri hazırlanıyor" notu çıkar.
import { DILLER, dilEsle } from "../shared/diller.js";

const ANAHTAR = "fal.dil";
let dil = "tr", S = {}, TR = {}, KART = null;

export const aktifDil = () => dil;
export const yerelKod = () => DILLER[dil].yerel;
export const metinler = () => S;
export const kartCevirisi = () => KART;

/** Metin: t("ana.basla") · değişkenli: t("ana.selam", { ad: "Erdem" }) */
export function t(k, v) {
  let s = S[k] ?? TR[k] ?? k;
  if (v) s = s.replace(/\{(\w+)\}/g, (_, x) => v[x] ?? "");
  return s;
}
/** Anahtar yoksa verilen değeri döndürür (burç, element, gezegen gibi veri değerleri için). */
export const tv = (on, deger) => S[`${on}.${deger}`] ?? TR[`${on}.${deger}`] ?? deger;

export function secilenDil() {
  try { const d = localStorage.getItem(ANAHTAR); if (d && DILLER[d]?.hazir) return d; } catch {}
  for (const l of navigator.languages || [navigator.language]) { const d = dilEsle(l); if (d) return d; }
  return "en";
}

const FONT = {
  latin: { url: "family=Cinzel:wght@500;700&family=Alegreya:ital,wght@0,400;0,500;1,400&family=Alegreya+Sans:wght@400;500;700" },
  kiril: { url: "family=Alegreya+SC:wght@500;700&family=Alegreya:ital,wght@0,400;0,500;1,400&family=Alegreya+Sans:wght@400;500;700&subset=cyrillic", d: '"Alegreya SC"' },
  yunan: { url: "family=Alegreya+SC:wght@500;700&family=Alegreya:ital,wght@0,400;0,500;1,400&family=Alegreya+Sans:wght@400;500;700&subset=greek", d: '"Alegreya SC"' },
  arap:  { url: "family=Amiri:ital,wght@0,400;0,700;1,400&family=Noto+Sans+Arabic:wght@400;500;700", d: '"Amiri"', r: '"Amiri"', u: '"Noto Sans Arabic"' },
  ja:    { url: "family=Shippori+Mincho:wght@500;700&family=Noto+Sans+JP:wght@400;500;700", d: '"Shippori Mincho"', r: '"Shippori Mincho"', u: '"Noto Sans JP"' },
  ko:    { url: "family=Nanum+Myeongjo:wght@400;700&family=Noto+Sans+KR:wght@400;500;700", d: '"Nanum Myeongjo"', r: '"Nanum Myeongjo"', u: '"Noto Sans KR"' },
};
function yaziTipi(yazi) {
  const f = FONT[yazi] || FONT.latin, root = document.documentElement.style;
  let l = document.getElementById("fontlar");
  const href = `https://fonts.googleapis.com/css2?${f.url}&display=swap`;
  if (l && l.href !== href) l.href = href;
  root.setProperty("--f-display", f.d ? `${f.d},Georgia,serif` : "");
  root.setProperty("--f-read", f.r ? `${f.r},Georgia,serif` : "");
  root.setProperty("--f-ui", f.u ? `${f.u},system-ui,sans-serif` : "");
  if (!f.d) ["--f-display", "--f-read", "--f-ui"].forEach(p => root.removeProperty(p));
}

const getJSON = async u => { try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch { return null; } };

export async function dilYukle(d = secilenDil()) {
  if (!DILLER[d]?.hazir) d = "tr";
  if (!Object.keys(TR).length) TR = (await getJSON("i18n/tr.json")) || {};
  S = d === "tr" ? TR : (await getJSON(`i18n/${d}.json`)) || {};
  KART = d === "tr" ? null : await getJSON(`data/kartlar/${d}.json`);
  dil = d;
  const h = document.documentElement; h.lang = d; h.dir = DILLER[d].yon || "ltr"; h.dataset.yazi = DILLER[d].yazi;
  yaziTipi(DILLER[d].yazi);
  // index.html içindeki sabit metinler
  document.querySelectorAll("[data-t]").forEach(e => e.textContent = t(e.dataset.t));
  document.querySelectorAll("[data-t-aria]").forEach(e => e.setAttribute("aria-label", t(e.dataset.tAria)));
  return d;
}
export function dilKaydet(d) { try { localStorage.setItem(ANAHTAR, d); } catch {} }

/** Türkçe desteyi seçili dile göre birleştirir (görüntüleme için). Analiz alanları (tema, motif, element) değişmez. */
const UZUN = ["dAnlam", "yAnlam", "hikaye", "mitDers", "mitDikkat", "mitGercek", "poz"];
export function desteBirlestir(D) {
  if (!KART) return D;
  const cards = D.cards.map(c => {
    const o = KART.cards?.[c.kod] || {}; const n = { ...c, ...o, ceviriEksik: [] };
    for (const k of UZUN) if (o[k] === undefined) { n[k] = k === "poz" ? null : ""; n.ceviriEksik.push(k); }
    return n;
  });
  const sets = D.sets.map(s => ({ ...s, ...(KART.sets?.[s.id] || {}), cerceve: KART.sets?.[s.id]?.cerceve || "" }));
  return { ...D, cards, sets, motifler: { ...D.motifler, ...(KART.motifler || {}) } };
}
