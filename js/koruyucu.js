// Set temaları ve koruyucu figürler.
// Koruyucu karga görselleri: assets/ui/koruyucular/G-S1.webp … G-S6.webp (yol app.config.js içinde).
// Koruyucu adları ve sözleri dil dosyalarındadır (i18n/tr.json: kor.S1.ad, kor.S1.soz …). TEMA'daki adlar yalnızca başvuru içindir;
// dosya yoksa aşağıdaki çizim (yer tutucu) gösterilir.
import { CONFIG } from "../app.config.js";
import { t } from "./i18n.js";

export const korAd = set => t(`kor.${set}.ad`);
export const korSoz = set => t(`kor.${set}.soz`);
export const TEMA = {
  S1: { renk: "#e2b04f", rgba: "rgba(226,176,79,A)", koruyucu: "Güneş Kargası", soz: "Göğün düzeni, adanmayla dönen güneşte saklıdır." },
  S2: { renk: "#e07b4a", rgba: "rgba(224,123,74,A)", koruyucu: "Defne Kargası", soz: "Tanrılardan alınan ateş, insanın kendi yolunu aydınlatır." },
  S3: { renk: "#8fc3ec", rgba: "rgba(143,195,236,A)", koruyucu: "Hafıza Kuzgunu", soz: "Düşünce ve hafıza, yıkımın ardındaki yeni dünyayı görür." },
  S4: { renk: "#9fd3b5", rgba: "rgba(159,211,181,A)", koruyucu: "Kızıl Toprak Kargası", soz: "Toprağın hafızası, sezgiyle yürüyene yol gösterir." },
  S5: { renk: "#7d8cf0", rgba: "rgba(125,140,240,A)", koruyucu: "Ankh Kargası", soz: "Karanlıktan geçen her yol, sabahın doğuşuna çıkar." },
  S6: { renk: "#e0566b", rgba: "rgba(224,86,107,A)", koruyucu: "Kader Kargası", soz: "Kırmızı ip dolanır, düğümlenir; ama kopmaz." },
};

/** Okumaya hâkim set: en çok kart; eşitlikte ya da hepsi farklıysa Kader (6.) kartının seti. */
export function baskinSet(cs) {
  const n = {}; cs.forEach(c => n[c.set] = (n[c.set] || 0) + 1);
  const max = Math.max(...Object.values(n)); const lider = Object.keys(n).filter(k => n[k] === max);
  const set = max >= 2 && lider.length === 1 ? lider[0] : cs[5].set;
  return { set, adet: n[set], neden: max >= 2 && lider.length === 1 ? "cogunluk" : "kader" };
}

const L = (c, d, w = 3) => `<g fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</g>`;
const CIZIM = {
  S1: c => L(c, `<circle cx="100" cy="110" r="34"/>${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<path d="M${100 + 44 * Math.cos(a)} ${110 + 44 * Math.sin(a)} q${8 * Math.cos(a + 1)} ${8 * Math.sin(a + 1)} ${22 * Math.cos(a)} ${22 * Math.sin(a)}"/>`; }).join("")}<path d="M40 200 c30 -30 50 10 80 -10 s40 -40 50 -20" stroke-width="5"/><circle cx="168" cy="168" r="3" fill="${c}"/>`),
  S2: c => L(c, `<path d="M92 210 l-8 -90 h32 l-8 90 z"/><path d="M80 120 h40"/><path d="M100 112 c-26 -18 -14 -48 0 -64 c4 18 18 22 16 40 c8 -6 10 -16 8 -24 c14 18 6 44 -24 48 z"/><path d="M100 104 c-8 -8 -4 -20 2 -26 c2 10 10 12 6 24"/>`),
  S3: c => L(c, `<path d="M58 150 c10 -40 40 -62 76 -58 c10 -14 26 -16 38 -8 c-10 2 -16 8 -18 16 c18 4 22 22 12 30 c-14 12 -44 18 -66 34 l-26 30 l6 -26 l-28 18 l14 -26 z"/><circle cx="160" cy="96" r="3" fill="${c}"/><path d="M80 210 h60"/>`),
  S4: c => L(c, `<path d="M100 200 c-22 -10 -30 -40 -24 -62 c4 -14 14 -22 24 -22 s20 8 24 22 c6 22 -2 52 -24 62 z"/><path d="M88 118 c-10 -20 -30 -30 -40 -50 M64 86 l-20 -10 M76 100 l-24 0 M112 118 c10 -20 30 -30 40 -50 M136 86 l20 -10 M124 100 l24 0"/><circle cx="90" cy="150" r="3" fill="${c}"/><circle cx="110" cy="150" r="3" fill="${c}"/><circle cx="100" cy="40" r="14" stroke-dasharray="3 5"/>`),
  S5: c => L(c, `<path d="M70 210 l10 -70 c-14 -6 -20 -20 -16 -34 l8 -58 l16 46 c8 -4 18 -4 26 0 l16 -46 l8 58 c4 14 -2 28 -16 34 l10 70"/><path d="M86 130 l14 8 l14 -8"/><path d="M100 150 v30 M90 165 h20"/><circle cx="100" cy="186" r="6"/>`),
  S6: c => L(c, `<path d="M70 200 l20 -40 c-26 -8 -30 -40 -6 -54 c20 -12 40 2 40 22 c0 10 -6 18 -14 24 l40 48"/><path d="M110 108 c4 -26 -4 -50 -20 -66 l-6 -10 l20 6"/><path d="M84 116 c10 4 24 2 34 -6"/></g><path d="M80 32 c40 20 -20 60 30 90 s60 40 40 80" fill="none" stroke="#e0566b" stroke-width="2.5" stroke-dasharray="1 0"/><g>`),
};

export function koruyucuSVG(set) {
  const t = TEMA[set];
  return `<svg viewBox="0 0 200 250" role="img" aria-label="${korAd(set)}"><defs><radialGradient id="h${set}"><stop offset="0" stop-color="${t.renk}" stop-opacity=".35"/><stop offset="1" stop-color="${t.renk}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="100" cy="125" r="100" fill="url(#h${set})"/><circle cx="100" cy="125" r="92" fill="none" stroke="${t.renk}" stroke-opacity=".35" stroke-dasharray="2 7"/>${CIZIM[set](t.renk)}</svg>`;
}

const yol = set => (CONFIG.GUARDIAN_IMAGE || "assets/ui/koruyucular/G-{set}.webp").replace("{set}", set);
/** Açılış sahnesinden önce görseli indirmeye başlar; sahne açıldığında görsel hazır olur. */
export function koruyucuOnYukle(set) { if (!YOK[set]) { const i = new Image(); i.decoding = "async"; i.src = yol(set); } }
/** Koruyucu figür: Canva görseli varsa o, yoksa çizim. */
// Görseli olmayan setler bir kez denendikten sonra hatırlanır; boşuna tekrar istek gönderilmez.
const YOK = window.__KYOK = window.__KYOK || {};
export function koruyucuHTML(set, cls = "") {
  const ic = YOK[set] ? `<div class="gsvg">${koruyucuSVG(set)}</div>`
    : `<img src="${yol(set)}" decoding="async" alt="${korAd(set)}" onerror="window.__KYOK['${set}']=1;this.replaceWith(Object.assign(document.createElement('div'),{className:'gsvg',innerHTML:window.__KSVG('${set}')}))">`;
  return `<div class="guard ${cls}" style="--g:${TEMA[set].renk}">${ic}</div>`;
}
window.__KSVG = koruyucuSVG;
