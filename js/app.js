// Uygulamanın ekranları ve akışı.
import { CONFIG } from "../app.config.js";
import { KATMANLAR, OKUMALAR, UCRETLI, FIYAT_TR } from "../shared/katmanlar.js";
import { POS, SIGNS, SIGN, TAGS, NIYET, sunSign, analyze } from "../shared/motor.js";
import { store, zamanAnahtarlari, gelistiriciAcik } from "./store.js";
import { okumaIste, hakDurumu, calismaModu, OkumaHatasi, reklamOncesi, bolgeDurumu, beklemeKaydet, bildirGonder, hesapVerisi, profilGonder, gecmisGonder, hesapVerisiSil } from "./ai.js";
import { dogumHaritasi, ILLER } from "../shared/natal.js";
import * as H from "./hesap.js";
import { ses, titres, gokyuzu, kivilcim, kivilcimEl, efektAyar, setEfekt, azHareket, sis, ortam } from "./fx.js";
import { TEMA, baskinSet, koruyucuHTML, koruyucuOnYukle, korAd, korSoz } from "./koruyucu.js";
import { t, tv, aktifDil, yerelKod, dilYukle, dilKaydet, desteBirlestir, kartCevirisi, metinler } from "./i18n.js";
import { DILLER, yerelIstem } from "../shared/diller.js";

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = ms => new Promise(r => setTimeout(r, azHareket() ? Math.min(ms, 60) : ms));
let D = null, DT = null, CARD = {}, SET = {}, MODE = "demo";
const DEV = () => gelistiriciAcik(CONFIG.GELISTIRICI);
let BOLGE = { izinli: true }; // Türkiye dışından erişimde okuma kapalı, bekleme listesi açık
// DT: Türkçe ana deste (analiz ve yorum istemi için) · D: seçili dile çevrilmiş görüntüleme destesi

/* ---------- Ortak parçalar ---------- */
const img = kod => (aktifDil() === "tr" ? CONFIG.CARD_IMAGE : CONFIG.CARD_IMAGE_INT || CONFIG.CARD_IMAGE).replace("{kod}", kod);
const face = c => `<div class="face"><img src="${img(c.kod)}" alt="${esc(c.ad)}" loading="lazy" decoding="async"></div>`;
function toast(t) { const e = $("#toast"); e.textContent = t; e.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove("show"), 2600); }
function md(t) {
  const inline = s => s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])_(.+?)_(?=[\s.,;:!?)]|$)/g, "$1<i>$2</i>").replace(/\*(.+?)\*/g, "<i>$1</i>");
  let h = "", para = []; const flush = () => { if (para.length) { h += `<p>${inline(para.join(" "))}</p>`; para = []; } };
  for (const l of esc(t).split("\n")) {
    if (/^#\s/.test(l)) { flush(); h += `<h1>${inline(l.slice(2))}</h1>`; }
    else if (/^##+\s/.test(l)) { flush(); h += `<h2>${inline(l.replace(/^##+\s/, ""))}</h2>`; }
    else if (!l.trim()) flush(); else para.push(l.replace(/^[-*]\s/, "• "));
  }
  flush(); return h;
}
const mdAkan = t => md(t).replace(/<\/(p|h1|h2)>$/, '<span class="caret" aria-hidden="true"></span></$1>');
const setRenkleri = () => D.sets.map(s => TEMA[s.id].renk);
// Yerelleştirilmiş veri değerleri
const posAd = i => t(`pos.${i}.ad`), posSoru = i => t(`pos.${i}.soru`);
const konum = o => t(`konum.${o}`);
const burcAd = b => tv("burc", b), elAd = e => tv("el", e), gezAd = g => tv("gez", g);
const katmanAd = k => t(`katman.${k}`), okumaAd = m => m ? t(`okuma.${m}`) : "";
const mitAd = id => t(`mit.${id}`);
// Set başlığı: Türkçede "Gökler / Aetherion", diğer dillerde yalnızca uluslararası ad
const setAd = s => aktifDil() === "tr" ? `${s.ad} / ${s.diger}` : s.diger;
const ceviriNot = () => `<p class="small muted">${t("ceviri.yakinda")}</p>`;
// Altı mitolojiyi temsil eden dönen işaret (ana sayfa, giriş, bekleme)
function SIGIL(cls = "") {
  if (CONFIG.MEDIA.logo) return `<div class="sigil logoimg ${cls}" aria-hidden="true"><img src="${CONFIG.MEDIA.logo}" alt=""></div>`;
  const r = setRenkleri();
  return `<div class="sigil ${cls}" aria-hidden="true"><svg viewBox="0 0 200 200">
   <g fill="none" stroke="#8496e0"><circle cx="100" cy="100" r="94" stroke-opacity=".25"/><circle class="r1" cx="100" cy="100" r="78" stroke-opacity=".5" stroke-dasharray="2 8"/><circle class="r2" cx="100" cy="100" r="58" stroke-opacity=".35" stroke-dasharray="14 6"/></g>
   <g class="r3">${r.map((c, i) => { const a = i * Math.PI / 3 - Math.PI / 2; return `<circle cx="${100 + 78 * Math.cos(a)}" cy="${100 + 78 * Math.sin(a)}" r="6" fill="${c}"/>`; }).join("")}</g>
   <g stroke="#d65a4f" stroke-width="3.5" stroke-linecap="round">${Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4, L = i % 2 ? 26 : 40; return `<line x1="${100 + 9 * Math.cos(a)}" y1="${100 + 9 * Math.sin(a)}" x2="${100 + L * Math.cos(a)}" y2="${100 + L * Math.sin(a)}"/>`; }).join("")}</g>
   <circle cx="100" cy="100" r="6" fill="#d65a4f"/></svg></div>`;
}
function setBack() {
  if (CONFIG.MEDIA.cardBack) { document.documentElement.style.setProperty("--back", `url("${CONFIG.MEDIA.cardBack}")`); return; }
  const rays = Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<line x1="${200 + 20 * Math.cos(a)}" y1="${320 + 20 * Math.sin(a)}" x2="${200 + (i % 2 ? 50 : 80) * Math.cos(a)}" y2="${320 + (i % 2 ? 50 : 80) * Math.sin(a)}"/>`; }).join("");
  const dots = setRenkleri().map((c, i) => { const a = i * Math.PI / 3 - Math.PI / 2; return `<circle cx="${200 + 150 * Math.cos(a)}" cy="${320 + 150 * Math.sin(a)}" r="7" fill="${c}"/>`; }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 640"><rect width="400" height="640" fill="#1a2150"/><rect x="18" y="18" width="364" height="604" rx="14" fill="none" stroke="#8496e0" stroke-opacity=".7" stroke-width="3"/><rect x="30" y="30" width="340" height="580" rx="10" fill="none" stroke="#8496e0" stroke-opacity=".35" stroke-width="2"/><g fill="none" stroke="#8496e0" stroke-opacity=".45" stroke-width="2"><circle cx="200" cy="320" r="120"/><circle cx="200" cy="320" r="150"/><circle cx="200" cy="320" r="96" stroke-dasharray="4 8"/></g>${dots}<g stroke="#d65a4f" stroke-width="5" stroke-linecap="round">${rays}</g><circle cx="200" cy="320" r="10" fill="#d65a4f"/></svg>`;
  document.documentElement.style.setProperty("--back", `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
}
function chrome(show, route) {
  $("#bar").classList.toggle("hidden", !show); $("#tabbar").classList.toggle("hidden", !show);
  $$("#tabbar a").forEach(a => a.dataset.r === route ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  $("#app").classList.toggle("withbg", !!(route === "ana" && CONFIG.MEDIA.homeBackground));
  $("#barGuard").innerHTML = ""; document.documentElement.style.removeProperty("--set");
  $("#katmanChip").textContent = katmanAd(store.katman()); $("#katmanChip").className = "chip" + (store.katman() !== "ucretsiz" ? " on" : "");
}
function openDialog(h, b) { $("#dlgH").innerHTML = h; $("#dlgB").innerHTML = b; $("#dlg").showModal(); $("#dlgB").scrollTop = 0; }
$("#dlgX").onclick = () => $("#dlg").close();
$("#dlg").addEventListener("click", e => { if (e.target === $("#dlg")) $("#dlg").close(); });
document.addEventListener("click", e => { if (e.target.closest("button,a,.lcard")) ses.dokun(); }, true);

/* ---------- Yönlendirme ---------- */
const ROUTES = { hosgeldin: viewHosgeldin, ana: viewAna, kartlar: viewKartlar, gecmis: viewGecmis, profil: viewProfil, premium: viewPremium, sonuc: viewSonuc, rehber: viewRehber, bolge: viewBolge };
let BEKLE = null, ILK = true;
function go(h) { if (location.hash === "#" + h) route(); else location.hash = h; }
function route() {
  const [r, arg] = (location.hash.slice(1) || "ana").split("-");
  if ($("#dlg").open) $("#dlg").close();
  document.querySelector(".reading")?.remove(); document.body.style.overflow = "";
  clearInterval(BEKLE);
  const p = store.profil();
  if (!BOLGE.izinli && r !== "bolge") return go("bolge");
  if (BOLGE.izinli && !p?.onay && r !== "hosgeldin") return go("hosgeldin");
  if (r !== "sonuc") ortam.durdur();
  sis.surekli(0);
  if (!ILK) { sis.gecis(); ses.gecis(); } ILK = false;
  (ROUTES[r] || viewAna)(arg); window.scrollTo(0, 0);
  const v = $("#view"); v.classList.remove("enter"); void v.offsetWidth; v.classList.add("enter");
}
addEventListener("hashchange", route);

/* ---------- Hoş geldin, giriş ve profil kurulumu ---------- */
const GLIF = Object.fromEntries(SIGNS.map((s, i) => [s[0], String.fromCodePoint(0x2648 + i) + "︎"]));
const ONAY_SURUM = "3", PAZ_SURUM = "1";
// Kullanıcının koruyucusu: kendi okumalarında en sık baskın gelen set; okuma yoksa Güneş burcunun en çok kartta yer aldığı set
function kullaniciKoruyucu(p) {
  const n = {}; store.gecmis().filter(r => !r.misafir && r.koruyucu).forEach(r => n[r.koruyucu] = (n[r.koruyucu] || 0) + 1);
  const en = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  if (en) return en[0];
  const s = {}; DT.cards.filter(c => c.burc === p?.burc).forEach(c => s[c.set] = (s[c.set] || 0) + 1);
  return Object.entries(s).sort((a, b) => b[1] - a[1])[0]?.[0] || "S1";
}
const korGorsel = set => CONFIG.GUARDIAN_IMAGE.replace("{set}", set);
function haritaKartlari(h, { elle = false } = {}) {
  const k = (tur, b, kesin) => `<div class="em ${b ? "" : "bos"}" data-tur="${tur}"><div class="gl">${b ? GLIF[b] : "?"}</div><span>${t("kr." + tur)}</span><b>${b ? burcAd(b) : t("kr.bilinmiyor")}</b>${b && !kesin ? `<i class="small muted">${t("kr.yaklasik")}</i>` : ""}</div>`;
  return `<div class="tri">${k("gunes", h.gunes, true)}${k("ay", h.ay, h.ayKesin)}${k("yk", h.yk, h.ykKesin)}</div>`;
}
const burcSecici = (id, sec) => `<select id="${id}"><option value="">${t("pf.ykYok")}</option>${SIGNS.map(s => `<option value="${s[0]}" ${sec === s[0] ? "selected" : ""}>${burcAd(s[0])}</option>`).join("")}</select>`;
function dogumAlanlari(p) {
  return `<label class="f">${t("pf.dt")}<input id="pDt" type="date" value="${esc(p.dt)}" min="1920-01-01" max="${new Date().toISOString().slice(0, 10)}"></label>
    <label class="f">${t("kr.saat")}<input id="pSa" type="time" value="${esc(p.saat || "")}" ${p.saatYok ? "disabled" : ""}></label>
    <label class="check"><input type="checkbox" id="pSaY" ${p.saatYok ? "checked" : ""}> <span>${t("kr.saatYok")}</span></label>
    <label class="f">${t("kr.yer")}<select id="pIl"><option value="">${t("kr.yerSec")}</option>${ILLER.map(i => `<option ${p.il === i[0] ? "selected" : ""}>${i[0]}</option>`).join("")}<option value="-" ${p.il === "-" ? "selected" : ""}>${t("kr.yerDiger")}</option></select></label>
    <p class="small muted">${t("kr.yerNot")}</p>`;
}
const dogumOku = () => ({ dt: $("#pDt").value, saat: $("#pSaY").checked ? "" : $("#pSa").value, saatYok: $("#pSaY").checked, il: $("#pIl").value });
function dogumOlaylari(f) {
  $("#pSaY").onchange = e => { $("#pSa").disabled = e.target.checked; f(); };
  ["#pDt", "#pSa", "#pIl"].forEach(s => $(s).addEventListener("input", f));
}

let KUR = null; // kurulum taslağı
function viewHosgeldin(adim) {
  chrome(false);
  if (adim === "profil") return viewKurulum();
  const M = CONFIG.MEDIA, hesap = H.hesapAcik() && MODE === "sunucu";
  if (hesap && H.kullanici()) return girisSonrasi(true);
  $("#view").innerHTML = `<section class="intro giris">
      ${M.introVideo ? `<video src="${M.introVideo}" ${M.introPoster ? `poster="${M.introPoster}"` : ""} autoplay muted playsinline loop></video>` : SIGIL("big")}
      <h1 class="glow">${esc(CONFIG.APP_NAME)}</h1><p class="muted">${t("intro.slogan")}</p>
      <div class="setline">${D.sets.map(s => `<span style="--c:${TEMA[s.id].renk}">${s.diger}</span>`).join("")}</div>
      ${hesap ? `<p class="small muted" style="max-width:34ch">${t("gr.aciklama")}</p>
      <div class="stack giris-dugmeler">
        <button class="btn google block" id="gG">${GOOGLE_SVG}${t("gr.google")}</button>
        <button class="btn block" id="gE">✉︎ ${t("gr.eposta")}</button>
        <div class="ya">${t("gr.yada")}</div>
        <button class="btn ghost block" id="gH">${t("gr.hesapsiz")}</button>
        <p class="note small">${t("gr.not")}</p></div>`
      : `<p class="small muted" style="max-width:34ch">${t("intro.aciklama")}</p><button class="btn primary" id="gH" style="min-width:200px">${t("intro.basla")}</button>`}
      <button class="chip dilchip" id="hDil">🌐 ${DILLER[aktifDil()].ad}</button></section>`;
  $("#hDil").onclick = dilSecici;
  $("#gH").onclick = () => { ses.acilis(); KUR = null; go("hosgeldin-profil"); };
  $("#gE")?.addEventListener("click", () => { ses.acilis(); hesapPenceresi("kayit", () => girisSonrasi()); });
  $("#gG")?.addEventListener("click", async e => { ses.acilis(); e.currentTarget.disabled = true; await googleGiris(() => girisSonrasi()); const b = $("#gG"); if (b) b.disabled = false; });
}
const GOOGLE_SVG = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.8c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-7.8-6C1 16.5 0 20.1 0 24s1 7.5 2.7 10.8l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>`;
async function googleGiris(sonra) {
  try { const u = await H.googleIleGiris(aktifDil()); if (u) { toast(t("hs.girildi")); await hakDurumu(); sonra ? await sonra() : route(); } }
  catch (e) { const k = H.hataAnahtari(e); if (k !== "hs.hata.iptal") toast(t(k) + (k === "hs.hata.genel" ? ` (${H.hataKodu(e)})` : "")); }
}
// Giriş yapıldıktan sonra: sunucudaki profil ve geçmiş cihazla birleştirilir; profil yoksa kurulum başlar.
async function girisSonrasi(sessiz, hedef = "ana") {
  const v = await hesapVerisi(); const yerel = store.profil();
  if (v?.gecmis?.length || store.gecmis().length) {
    const hepsi = [...store.gecmis(), ...(v?.gecmis || [])]; const g = new Map(); hepsi.forEach(r => { if (!g.has(r.id)) g.set(r.id, r); });
    store.setGecmis([...g.values()].sort((a, b) => Date.parse(b.tarih) - Date.parse(a.tarih)).slice(0, 40));
    if (store.gecmis().length !== (v?.gecmis || []).length) gecmisGonder(store.gecmis());
  }
  if (v?.profil?.onay) { store.setProfil({ ...v.profil }); if (!sessiz) toast(v.profil.ad ? t("pf.hosgeldinAd", { ad: v.profil.ad }) : t("pf.hosgeldin")); return go(hedef); }
  if (yerel?.onay) { profilGonder({ ...yerel, pazarlama: yerel.pazarlama || { onay: false } }); return go(hedef); }
  const u = H.kullanici(); KUR = { ad: (u?.displayName || "").split(" ")[0].slice(0, 30), niyet: "genel" };
  go("hosgeldin-profil");
}

function viewKurulum() {
  chrome(false);
  if (!KUR) KUR = { ...(store.profil() || {}), niyet: "genel" };
  KUR.adim = KUR.adim || 1;
  const n = KUR.adim, ust = `<div class="row" style="justify-content:space-between"><button class="btn ghost small" id="kGeri">‹ ${t("kr.geri")}</button><span class="small muted">${n} / 4</span></div>
    <div class="adimlar">${[1, 2, 3, 4].map(i => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</div>`;
  let govde = "";
  if (n === 1) govde = `<h2>${t("kr.b1")}</h2><p class="small muted">${t("kr.a1")}</p>
    <label class="f">${t("pf.ad")}<input id="pAd" value="${esc(KUR.ad || "")}" autocomplete="given-name" maxlength="30" enterkeyhint="next"></label>
    <div class="bosluk"></div><button class="btn primary block" id="kIleri">${t("genel.devam")}</button>`;
  if (n === 2) govde = `<h2>${t("kr.b2")}</h2><p class="small muted">${t("kr.a2")}</p>${dogumAlanlari(KUR)}
    <div class="bosluk"></div><button class="btn primary block" id="kIleri" disabled>${t("kr.hesapla")}</button>`;
  if (n === 3) {
    const h = KUR.harita;
    govde = `<h2>${KUR.ad ? t("kr.b3Ad", { ad: esc(KUR.ad) }) : t("kr.b3")}</h2>
      <p class="small muted">${esc(tarihYaz(KUR.dt + "T12:00:00"))}${KUR.saat ? " · " + esc(KUR.saat) : ""}${KUR.il && KUR.il !== "-" ? " · " + esc(KUR.il) : ""}</p>
      <div class="harita-yukle" id="hYuk">${SIGIL("big spin")}<p class="small muted">${t("kr.hesaplaniyor")}</p></div>
      <div id="hSon" class="stack hidden" style="gap:14px">${haritaKartlari(h)}
      <section class="panel stack" style="gap:6px"><h3>${t("kr.ozun")}</h3><p class="small muted">${t(h.yk ? "kr.oz" : "kr.ozYk0", { g: `<b>${burcAd(h.gunes)}</b>`, a: `<b>${burcAd(h.ay)}</b>`, y: h.yk ? `<b>${burcAd(h.yk)}</b>` : "" })}</p></section>
      <section class="panel row korsat"><div class="stack" style="gap:2px"><span class="lab">${t("kr.koruyucu")}</span><b class="disp">${esc(korAd(kullaniciKoruyucu({ burc: h.gunes })))}</b><span class="small muted">${esc(setAd(SET[kullaniciKoruyucu({ burc: h.gunes })]))}</span></div><img src="${korGorsel(kullaniciKoruyucu({ burc: h.gunes }))}" alt=""></section>
      <details class="elle"><summary class="small">${t(h.yk ? "kr.elleDuzelt" : "kr.elleYk")}</summary>
        <div class="stack" style="gap:10px;margin-top:10px"><label class="f">${t("pf.yk")}${burcSecici("eYk", h.yk)}</label><label class="f">${t("kr.ayElle")}${burcSecici("eAy", h.ay)}</label></div></details>
      <p class="note small">${t("kr.hataPayi")}</p></div>
      <div class="bosluk"></div><button class="btn primary block" id="kIleri" disabled>${t("genel.devam")}</button>`;
  }
  if (n === 4) {
    const hesapli = !!H.kullanici();
    govde = `<h2>${t("kr.b4")}</h2><p class="small muted">${t("kr.a4")}</p>
      <section class="panel stack onaylar"><span class="lab">${t("kr.zorunlu")}</span>
        <label class="check"><input type="checkbox" id="c18"> ${t("pf.onay18")}</label>
        <label class="check"><input type="checkbox" id="cEg"> <span>${t("pf.onayKosul", { btn: `<button type="button" class="chip" id="kosul" style="display:inline;padding:0 6px">${t("pf.kosulBtn")}</button>` })}</span></label>
        <label class="check"><input type="checkbox" id="cKv"> <span>${t("kr.onayAktarim", { btn: `<button type="button" class="chip" id="kvkk" style="display:inline;padding:0 6px">${t("pf.onayMetinBtn")}</button>` })}</span></label></section>
      ${hesapli ? `<section class="panel stack onaylar"><span class="lab">${t("kr.istege")}</span>
        <label class="check"><input type="checkbox" id="cPz"> <span>${t("kr.pazarlama")}</span></label></section>` : ""}
      <div class="bosluk"></div><button class="btn primary block" id="kIleri" disabled>${t("kr.basla")}</button>`;
  }
  $("#view").innerHTML = `<section class="stack kurulum" style="gap:14px">${ust}<div class="stack kadim" style="gap:14px">${govde}</div></section>`;
  $("#kGeri").onclick = () => { if (n === 1) { KUR = null; go("hosgeldin"); } else { KUR.adim = n - 1; viewKurulum(); } };
  const ileri = $("#kIleri"), sonraki = () => { KUR.adim = n + 1; ses.gecis?.(); viewKurulum(); window.scrollTo(0, 0); };
  if (n === 1) { $("#pAd").focus(); $("#pAd").onkeydown = e => { if (e.key === "Enter") ileri.click(); }; ileri.onclick = () => { KUR.ad = $("#pAd").value.trim(); sonraki(); }; }
  if (n === 2) {
    const f = () => { Object.assign(KUR, dogumOku()); ileri.disabled = !sunSign(KUR.dt) || (!KUR.saatYok && !KUR.saat) || !KUR.il; };
    dogumOlaylari(f); f();
    ileri.onclick = () => { KUR.harita = dogumHaritasi(KUR.dt, KUR.saat, KUR.il); KUR.ykElle = false; sonraki(); };
  }
  if (n === 3) {
    const goster = async () => {
      await sleep(KUR.goruldu ? 0 : 1500); KUR.goruldu = true;
      $("#hYuk")?.remove(); $("#hSon")?.classList.remove("hidden"); ileri.disabled = false;
      $$(".tri .em").forEach((e, i) => setTimeout(() => { e.classList.add("gel"); if (!azHareket()) kivilcimEl(e, { n: 10, hiz: 50 }); }, 150 + i * 260));
      ses.tamam(); titres(20);
    };
    goster();
    const elle = () => { const y = $("#eYk").value, a = $("#eAy").value; KUR.ykElle = y !== (KUR.harita.yk || ""); KUR.yk = y; KUR.ayDuzelt = a; };
    $("#eYk").onchange = elle; $("#eAy").onchange = elle;
    ileri.onclick = () => { const h = KUR.harita; KUR.burc = h.gunes; KUR.yk = $("#eYk").value; KUR.ay = $("#eAy").value; KUR.ykElle = KUR.yk !== (h.yk || ""); sonraki(); };
  }
  if (n === 4) {
    const f = () => ileri.disabled = !($("#c18").checked && $("#cEg").checked && $("#cKv").checked);
    $$(".onaylar input").forEach(e => e.addEventListener("change", f));
    $("#kvkk").onclick = e => { e.preventDefault(); hukukMetni("aydinlatma"); };
    $("#kosul").onclick = e => { e.preventDefault(); hukukMetni("kosullar"); };
    ileri.onclick = async () => {
      const simdi = new Date().toISOString(), pz = !!$("#cPz")?.checked;
      const p = { ad: KUR.ad || "", dt: KUR.dt, saat: KUR.saat || "", il: KUR.il || "", burc: KUR.burc, ay: KUR.ay || "", yk: KUR.yk || "", ykElle: !!KUR.ykElle, niyet: "genel",
        onay: { tarih: simdi, surum: ONAY_SURUM, dil: aktifDil(), kosullar: true, aktarim: true, yas18: true },
        pazarlama: { onay: pz, tarih: pz ? simdi : "", surum: PAZ_SURUM } };
      store.setProfil(p); KUR = null; ileri.disabled = true;
      if (H.kullanici()) { profilGonder(p); if (store.gecmis().length) gecmisGonder(store.gecmis()); }
      kivilcimEl(ileri, { n: 24 }); ses.tamam(); toast(p.ad ? t("pf.hosgeldinAd", { ad: p.ad }) : t("pf.hosgeldin"));
      await sleep(500); go("ana");
    };
  }
}

// Profil düzenleme: ad ve doğum bilgileri; harita anında yeniden hesaplanır
function viewProfilForm() {
  const p = store.profil() || {}; const T = { ...p, saatYok: !p.saat && !!p.dt };
  $("#view").innerHTML = `<section class="stack" style="gap:14px"><h2>${t("pf.baslik")}</h2>
    <label class="f">${t("pf.ad")}<input id="pAd" value="${esc(p.ad)}" autocomplete="given-name" maxlength="30"></label>
    ${dogumAlanlari(T)}<div id="pHar"></div>
    <details class="elle" ${p.ykElle ? "open" : ""}><summary class="small">${t("kr.elleDuzelt")}</summary>
      <div class="stack" style="gap:10px;margin-top:10px"><label class="f">${t("pf.yk")}${burcSecici("eYk", p.yk)}</label><label class="f">${t("kr.ayElle")}${burcSecici("eAy", p.ay)}</label></div></details>
    <button class="btn primary block" id="pKaydet">${t("genel.kaydet")}</button><a class="btn ghost block" href="#profil">${t("genel.vazgec")}</a></section>`;
  let h = null;
  const f = () => {
    const d = dogumOku(); h = sunSign(d.dt) ? dogumHaritasi(d.dt, d.saat, d.il) : null;
    if (h && !$("#eYk").dataset.dokunuldu) { $("#eYk").value = h.yk || p.yk || ""; }
    if (h && !$("#eAy").dataset.dokunuldu) { $("#eAy").value = h.ay || ""; }
    $("#pHar").innerHTML = h ? haritaKartlari({ ...h, yk: $("#eYk").value, ay: $("#eAy").value, ykKesin: h.ykKesin || !!$("#eYk").dataset.dokunuldu }) : "";
    $$("#pHar .em").forEach(e => e.classList.add("gel"));
    $("#pKaydet").disabled = !h;
  };
  dogumOlaylari(f);
  ["#eYk", "#eAy"].forEach(s => $(s).onchange = e => { e.target.dataset.dokunuldu = "1"; f(); });
  if (p.ykElle) $("#eYk").dataset.dokunuldu = "1";
  f();
  $("#pKaydet").onclick = () => {
    const d = dogumOku();
    const n = { ...p, ad: $("#pAd").value.trim(), dt: d.dt, saat: d.saat, il: d.il, burc: h.gunes, yk: $("#eYk").value, ay: $("#eAy").value, ykElle: $("#eYk").value !== (h.yk || "") };
    store.setProfil(n); if (H.kullanici()) profilGonder(n); ses.tamam(); toast(t("pf.kaydedildi")); go("profil");
  };
}
// Hukuki metinler: data/hukuk/tr.json (hukukçu onayından sonra diğer dillere çevrilecek)
let HUKUK = null;
async function hukukMetni(tur = "aydinlatma") {
  if (!HUKUK) { try { HUKUK = await (await fetch("data/hukuk/tr.json")).json(); } catch { HUKUK = {}; } }
  const m = HUKUK[tur];
  const ozet = tur === "aydinlatma" && aktifDil() !== "tr" ? ["sorumlu", "veriler", "amac", "aktarim", "haklar"].map(k => `<p>${t("gz." + k)}</p>`).join("") : "";
  const govde = m ? `${aktifDil() !== "tr" ? `${ozet}<p class="note small">${t("hk.ceviri")}</p>` : ""}<div lang="tr" dir="ltr" class="hukuk">${m.html}</div>`
    : ["sorumlu", "veriler", "amac", "aktarim", "haklar"].map(k => `<p>${t("gz." + k)}</p>`).join("");
  openDialog(`<div class="lab">${t("pr.hukuk")}</div><h2>${t("hk." + tur)}</h2>`, `<div class="read small stack" style="gap:10px">${govde}</div>`);
}

/* ---------- Dil seçimi ---------- */
function dilSecici() {
  openDialog(`<div class="lab">🌐</div><h2>${t("dil.baslik")}</h2>`, `<div class="dilliste">${Object.entries(DILLER).filter(([, v]) => v.hazir || DEV()).map(([k, v]) =>
    `<button class="dilbtn ${k === aktifDil() ? "on" : ""}" data-d="${k}" ${v.hazir ? "" : "disabled"} lang="${k}" dir="${v.yon || "ltr"}"><b>${v.ad}</b>${v.hazir ? "" : `<span class="small muted">${t("dil.yakinda")}</span>`}</button>`).join("")}</div>`);
  $$(".dilbtn[data-d]").forEach(b => b.onclick = async () => {
    if (b.disabled) return; dilKaydet(b.dataset.d); $("#dlg").close();
    await dilUygula(b.dataset.d); toast(t("dil.secildi")); route();
  });
}
async function dilUygula(d) {
  await dilYukle(d);
  D = desteBirlestir(DT); CARD = {}; SET = {}; D.cards.forEach(c => CARD[c.kod] = c); D.sets.forEach(s => SET[s.id] = s);
  document.title = CONFIG.APP_NAME;
  D.cards.forEach(c => { const i = new Image(); i.src = img(c.kod); });
}

/* ---------- Ana sayfa ---------- */
let SECIM = { niyet: "genel", soru: "", derin: false, kim: "ben", misafir: { ad: "", dt: "", yk: "", onay: false } };
function gununKarti(burc) {
  const g = zamanAnahtarlari().gun + burc; let h = 2166136261;
  for (const ch of g) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return D.cards[(h >>> 0) % D.cards.length];
}
const halka = (kalan, top, et) => { const r = 22, C = 2 * Math.PI * r, f = top ? kalan / top : 1;
  return `<div class="ring"><svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="${r}" class="bg"/><circle cx="28" cy="28" r="${r}" class="fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - f)}"/></svg><b>${et ?? kalan}</b></div>`; };
async function viewAna() {
  chrome(true, "ana"); const p = store.profil();
  if (CONFIG.MEDIA.homeBackground) $("#app").style.setProperty("--homebg", `url("${CONFIG.MEDIA.homeBackground}")`);
  const saat = new Date().getHours(); const selam = t(saat < 6 ? "ana.selamGece" : saat < 12 ? "ana.selamSabah" : saat < 18 ? "ana.selamGun" : "ana.selamAksam");
  const g = store.gecmis().slice(0, 3); const gk = gununKarti(p.burc);
  $("#view").innerHTML = `
   <section class="welcome">${SIGIL()}<div class="stack" style="gap:6px"><p class="muted">${selam}${p.ad ? ", " + esc(p.ad) : ""}</p>
     <div class="row"><span class="chip on">${burcAd(p.burc)}</span><span class="chip el-${SIGN[p.burc].el}">${elAd(SIGN[p.burc].el)}</span>${p.yk ? `<span class="chip">${t("ana.yukselen", { b: burcAd(p.yk) })}</span>` : ""}${DEV() && MODE !== "sunucu" ? `<span class="chip warn">${t("mod." + MODE)}</span>` : ""}</div></div></section>
   <section class="panel hero">
     <div class="lab">${t("ana.etiket")}</div><h2>${t("ana.baslik")}</h2>
     <div class="stack"><span class="small muted">${t("ana.niyet")}</span><div class="row" id="niyet">${Object.keys(NIYET).map(k => `<button class="chip ${SECIM.niyet === k ? "on" : ""}" data-k="${k}">${t("niyet." + k)}</button>`).join("")}</div></div>
     <label class="f">${t("ana.soru")}<input id="soru" maxlength="160" value="${esc(SECIM.soru)}" placeholder="${t("ana.soruOrnek")}"></label>
     <div class="stack" style="gap:8px"><span class="small muted">${t("kim.baslik")}</span><div class="row" id="kim">${["ben", "misafir"].map(k => `<button class="chip ${SECIM.kim === k ? "on" : ""}" data-k="${k}">${t("kim." + k)}</button>`).join("")}</div><div id="misafirBox"></div></div>
     <div id="derinBox"></div>
     <div class="quota" id="quota">${halka(0, 1, "–")}${halka(0, 1, "–")}${halka(0, 1, "–")}</div>
     <div class="quota-l"><span>${t("ana.bugun")}</span><span>${t("ana.buHafta")}</span><span>${t("ana.derin")}</span></div>
     <button class="btn primary block cta" id="basla" disabled><span>${t("ana.cta")}</span></button>
     <p class="small muted" id="hakNot"></p>
   </section>
   <button class="daily" id="gun" style="--c:${TEMA[gk.set].renk}">${face(gk)}<div class="stack" style="gap:4px"><span class="lab">${t("ana.gununIsareti")} · ${SET[gk.set].diger}</span><b>${esc(gk.ad)}</b><span class="small muted">${esc(gk.dAnahtar)}</span>${gk.mitDers ? `<span class="small" style="color:var(--c)">${esc(gk.mitDers.split(/(?<=[.;。])\s*/)[0])}</span>` : ""}</div></button>
   ${g.length ? `<section class="stack"><div class="row" style="justify-content:space-between"><h3>${t("ana.sonOkumalar")}</h3><a class="small" href="#gecmis" style="color:var(--blue)">${t("ana.tumu")}</a></div><div class="hist">${g.map(histItem).join("")}</div></section>` : ""}`;
  $$("#niyet button").forEach(b => b.onclick = () => { SECIM.niyet = b.dataset.k; $$("#niyet button").forEach(x => x.classList.toggle("on", x === b)); });
  $("#soru").oninput = e => SECIM.soru = e.target.value;
  $("#gun").onclick = () => kartDetay(gk.kod);
  let hakVar = false;
  const misafirGecerli = () => SECIM.kim !== "misafir" || (!!sunSign(SECIM.misafir.dt) && SECIM.misafir.onay);
  const ctaGuncelle = () => { $("#basla").disabled = !(hakVar && misafirGecerli()); };
  const misafirCiz = () => {
    const M = SECIM.misafir, b = $("#misafirBox");
    if (SECIM.kim !== "misafir") { b.innerHTML = ""; return ctaGuncelle(); }
    b.innerHTML = `<div class="misafir stack" style="gap:10px"><div class="lab">${t("mf.baslik")}</div>
      <label class="f">${t("mf.ad")}<input id="mAd" maxlength="30" value="${esc(M.ad)}" autocomplete="off"></label>
      <label class="f">${t("mf.dt")}<input id="mDt" type="date" value="${esc(M.dt)}" max="${new Date().toISOString().slice(0, 10)}"></label>
      <label class="f">${t("pf.yk")}<select id="mYk"><option value="">${t("pf.ykYok")}</option>${SIGNS.map(x => `<option value="${x[0]}" ${M.yk === x[0] ? "selected" : ""}>${burcAd(x[0])}</option>`).join("")}</select></label>
      <div id="mBurc" class="row"></div>
      <label class="check"><input type="checkbox" id="mOn" ${M.onay ? "checked" : ""}> <span class="small">${t("mf.onay")}</span></label>
      <p class="small muted">${t("kim.not")}</p></div>`;
    const g = () => { M.ad = $("#mAd").value.trim(); M.dt = $("#mDt").value; M.yk = $("#mYk").value; M.onay = $("#mOn").checked;
      const bb = sunSign(M.dt); $("#mBurc").innerHTML = bb ? `<span class="chip on">${burcAd(bb)}</span><span class="chip el-${SIGN[bb].el}">${elAd(SIGN[bb].el)}</span>` : ""; ctaGuncelle(); };
    $$("#misafirBox input,#misafirBox select").forEach(e => e.addEventListener("input", g)); g();
  };
  $$("#kim button").forEach(b => b.onclick = () => { SECIM.kim = b.dataset.k; $$("#kim button").forEach(x => x.classList.toggle("on", x === b)); misafirCiz(); });
  misafirCiz();
  const h = await hakDurumu(); if (h.bolge) { BOLGE = { izinli: false }; return go("bolge"); } const k = KATMANLAR[h.katman];
  $("#quota").innerHTML = halka(h.gunKalan, h.gunluk, `${h.gunKalan}/${h.gunluk}`) + halka(h.haftaKalan, h.haftalik, `${h.haftaKalan}/${h.haftalik}`) + (h.derinAylik ? halka(h.derinKalan, h.derinAylik, `${h.derinKalan}/${h.derinAylik}`) : halka(0, 1, "–"));
  const var_ = h.gunKalan > 0 && h.haftaKalan > 0; hakVar = var_; ctaGuncelle();
  if (k.okuma === "tam" && h.derinKalan > 0) {
    $("#derinBox").innerHTML = `<label class="check"><input type="checkbox" id="derin" ${SECIM.derin ? "checked" : ""}> ${t("ana.derinKullan", { n: h.derinKalan })}</label>`;
    $("#derin").onchange = e => SECIM.derin = e.target.checked;
  } else SECIM.derin = false;
  const okumaTuru = k.okuma === "derin" && h.derinKalan <= 0 ? "tam" : k.okuma;
  $("#hakNot").innerHTML = var_ ? t("ana.hakNot", { okuma: okumaAd(okumaTuru), katman: katmanAd(h.katman) }) + (k.okuma === "derin" && h.derinKalan <= 0 ? `<br>${t("ana.derinSinir")}` : "")
    : `${t(h.gunKalan <= 0 ? "ana.hakBittiGun" : "ana.hakBittiHafta")} ${h.katman !== "elmas" ? `<a href="#premium" style="color:var(--blue)">${t("ana.premiumIle")}</a>` : ""}`;
  $("#basla").onclick = async () => { if (!misafirGecerli()) return; $("#basla").disabled = true; const ok = await reklamOncesi(h.katman); ctaGuncelle(); if (ok) okumaBaslat(); };
}
function histItem(r) {
  const d = new Date(r.tarih); const ks = r.koruyucu || baskinSet(r.picks.map(p => CARD[p.kod])).set;
  return `<a class="hitem" href="#sonuc-${r.id}" style="--c:${TEMA[ks].renk}">${koruyucuHTML(ks, "mini")}
   <div class="stack" style="gap:2px;flex:1"><span class="t">${esc(r.baslik || t("genel.okuma"))}</span><span class="small muted">${d.toLocaleDateString(yerelKod(), { day: "numeric", month: "long" })} · ${okumaAd(r.mod)}${r.misafir ? ` · ${esc(t("mf.etiket", { ad: r.misafir.ad || t("mf.isimsiz") }))}` : ""}</span></div>
   <div class="thumbs">${r.picks.slice(0, 3).map(p => `<img src="${img(p.kod)}" alt="">`).join("")}</div></a>`;
}

/* ---------- Okuma akışı ---------- */
let CTL = null;
function okumaBaslat() {
  const order = [...D.cards.map(c => c.kod)].sort(() => Math.random() - .5);
  const picks = []; let pending = null;
  const ov = document.createElement("div"); ov.className = "reading dealing"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", t("ok.aria"));
  const sesAcik = () => efektAyar().ses;
  ov.innerHTML = `<div class="rhead"><button class="btn ghost icon" id="rx" aria-label="${t("genel.kapat")}">✕</button><h2 id="rt">${t("ok.karistiriliyor")}</h2>
     <div class="row" style="gap:10px"><div class="dots" id="rd">${POS.map(() => "<i></i>").join("")}</div><button class="btn ghost icon" id="rm" aria-label="${t("ok.sesAria")}">${sesAcik() ? "♪" : "–"}</button></div></div>
   <p class="hint small muted" id="rhint">${t("ok.ipucu")}</p>
   <div class="grid" id="rg">${order.map((k, i) => `<button class="gcard" data-k="${k}" aria-label="${t("ok.kapaliKart", { n: i + 1 })}" disabled><span class="badge"></span><span class="in"><span class="back"></span></span></button>`).join("")}</div>
   <div class="tray" id="rtr">${POS.map((p, i) => `<div class="slot" data-i="${i}"><span class="sl">${posAd(i)}</span></div>`).join("")}</div>
   <div class="sheet" id="sh"><div class="lab" id="shp"></div><div style="font-family:var(--f-display);font-size:18px;margin-top:4px">${t("ok.nasilKoy")}</div>
     <div class="choice"><button id="chD"><span class="shape"></span>${konum("D")}</button><button id="chY"><span class="shape h"></span>${konum("Y")}</button><button id="chX"><span class="shape" style="border-style:dashed;border-color:var(--dim)"></span>${t("genel.vazgec")}</button></div>
     <p class="small muted" style="margin-top:10px">${t("ok.konumAciklama")}</p></div>`;
  document.body.appendChild(ov); document.body.style.overflow = "hidden";
  const kartlar = [...ov.querySelectorAll(".gcard")];
  const baslik = () => {
    $$("#rd i").forEach((d, i) => d.classList.toggle("on", i < picks.length));
    $$("#rtr .slot").forEach((s, i) => s.classList.toggle("next", i === picks.length));
    $("#rt").textContent = picks.length < 6 ? t("ok.kartNo", { n: picks.length + 1, pos: posAd(picks.length) }) : t("ok.hazir");
    $("#rhint").textContent = picks.length < 6 ? posSoru(picks.length) : t("ok.aciliyor");
  };
  const close = () => { ov.remove(); document.body.style.overflow = ""; };
  ortam.baslat(); sis.surekli(0.7); sis.gecis();
  const sheet = on => { $("#sh").classList.toggle("show", on); if (!on) { pending?.classList.remove("sel"); pending = null; } };
  $("#rx").onclick = () => { close(); ortam.durdur(); sis.surekli(0); };
  $("#rm").onclick = () => { setEfekt("ses", !sesAcik()); $("#rm").textContent = sesAcik() ? "♪" : "–"; toast(t(sesAcik() ? "ok.sesAcik" : "ok.sesKapali")); };

  // Karıştırma ve dağıtma
  (async () => {
    const g = $("#rg").getBoundingClientRect(), cx = g.left + g.width / 2, cy = g.top + g.height / 2;
    const anim = (el, kf, o) => el.animate ? el.animate(kf, { fill: "both", ...o }).finished.catch(() => {}) : Promise.resolve();
    const off = kartlar.map(b => { const r = b.getBoundingClientRect(); return { x: cx - (r.left + r.width / 2), y: cy - (r.top + r.height / 2) }; });
    if (azHareket()) { ov.classList.remove("dealing"); kartlar.forEach(b => b.disabled = false); baslik(); return; }
    kartlar.forEach((b, i) => b.style.transform = `translate(${off[i].x}px,${off[i].y}px) rotate(${(Math.random() * 10 - 5).toFixed(1)}deg)`);
    await sleep(250); ses.karistir();
    for (let tur = 0; tur < 2; tur++) {
      await Promise.all(kartlar.map((b, i) => { const sol = i % 2 ? -1 : 1, base = `translate(${off[i].x}px,${off[i].y}px)`;
        return anim(b, [{ transform: base }, { transform: `translate(${off[i].x + sol * 34}px,${off[i].y - 6}px) rotate(${sol * 8}deg)` }, { transform: base }], { duration: 380, easing: "ease-in-out" }); }));
    }
    kartlar.forEach(b => b.style.transform = "");
    await Promise.all(kartlar.map((b, i) => { setTimeout(() => ses.dagit(i), i * 28);
      return anim(b, [{ transform: `translate(${off[i].x}px,${off[i].y}px) rotate(${(Math.random() * 16 - 8).toFixed(1)}deg)`, opacity: 1 }, { transform: "translate(0,0) rotate(0)", opacity: 1 }], { duration: 520, delay: i * 28, easing: "cubic-bezier(.2,.75,.25,1)" }); }));
    kartlar.forEach(b => { b.getAnimations?.().forEach(a => a.cancel()); b.disabled = false; });
    ov.classList.remove("dealing"); baslik(); titres(15);
  })();

  kartlar.forEach(b => b.onclick = () => {
    if (picks.length >= 6 || b.classList.contains("taken")) return;
    pending?.classList.remove("sel"); pending = b; b.classList.add("sel");
    ses.kaldir(); titres(10); kivilcimEl(b, { n: 6, renk: "mavi", hiz: 40, omur: 1.2 });
    $("#shp").textContent = t("ok.pozisyon", { n: picks.length + 1, pos: posAd(picks.length), soru: posSoru(picks.length) }); sheet(true); $("#chD").focus();
  });
  const place = async o => {
    if (!pending) return; const b = pending, i = picks.length; sheet(false);
    picks.push({ kod: b.dataset.k, o }); b.classList.add("taken"); b.querySelector(".badge").textContent = picks.length;
    const slot = $$("#rtr .slot")[i]; const from = b.getBoundingClientRect(), to = slot.getBoundingClientRect();
    const h = to.height * 0.86, w = h * 400 / 640;
    const fly = document.createElement("div"); fly.className = "fly"; fly.innerHTML = `<span class="back"></span>`;
    Object.assign(fly.style, { left: from.left + "px", top: from.top + "px", width: from.width + "px", height: from.height + "px" });
    ov.appendChild(fly);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2), sc = h / from.height;
    if (fly.animate && !azHareket()) await fly.animate([{ transform: "none" }, { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 60}px) scale(${(1 + sc) / 2 + 0.25}) rotate(${o === "Y" ? 45 : 0}deg)` }, { transform: `translate(${dx}px,${dy}px) scale(${sc}) rotate(${o === "Y" ? 90 : 0}deg)` }], { duration: 560, easing: "cubic-bezier(.3,.6,.2,1)", fill: "forwards" }).finished.catch(() => {});
    fly.remove();
    slot.innerHTML = `<div class="m ${o === "Y" ? "y" : ""}" style="height:${h}px;width:${w}px"><span class="back"></span></div><span class="sl">${posAd(i)}</span>`; slot.classList.add("full");
    ses.yerlestir(i); titres([8, 40, 12]); sis.duman(slot, { n: 4, tepe: 0.45 }); kivilcimEl(slot, { n: 5, renk: "kirmizi", hiz: 30, omur: 1.4 });
    baslik();
    if (picks.length === 6) { ses.tamam(); $("#rtr").classList.add("done"); await sleep(900); close(); acilis(picks); }
  };
  $("#chD").onclick = () => place("D"); $("#chY").onclick = () => place("Y"); $("#chX").onclick = () => sheet(false);
}

async function acilis(picks) {
  const p = store.profil(); const M = SECIM.kim === "misafir" ? SECIM.misafir : null;
  const kisi = M ? { ad: M.ad, dt: M.dt, yk: M.yk, burc: sunSign(M.dt) } : p;
  const P = { ...kisi, niyet: SECIM.niyet, soru: SECIM.soru.trim() };
  const k = KATMANLAR[store.katman()]; let mod = k.okuma === "tam" && SECIM.derin ? "derin" : k.okuma;
  const tOk = DEV() ? testOkuma() : ""; if (tOk) mod = tOk; // geliştirici görünümü: okuma türü denemesi (sunucu yalnızca tam erişim kodunda uygular)
  const A = analyze(D, picks, P); const B = baskinSet(A.cs); koruyucuOnYukle(B.set);
  const At = analyze(DT, picks, P); const yerel = yerelIstem(aktifDil(), metinler(), kartCevirisi(), At.cs);
  const id = Date.now().toString(36);
  // Aynı kişinin son 45 gündeki tamamlanmış okumaları (misafir okumalarında gönderilmez)
  const onceki = M ? [] : store.gecmis().filter(r => r.durum === "tamam" && !r.misafir && !r.demo && Date.now() - Date.parse(r.tarih) < 45 * 864e5).slice(0, 3).map(r => ({ tarih: r.tarih, picks: r.picks.map(p => ({ kod: p.kod, o: p.o })) }));
  store.addGecmis({ id, tarih: new Date().toISOString(), picks, profil: { burc: P.burc, yk: P.yk, niyet: P.niyet, soru: P.soru }, mod, metin: "", baslik: "", durum: "bekliyor", koruyucu: B.set, dil: aktifDil(), ...(M ? { misafir: { ad: M.ad, burc: P.burc } } : {}) });
  if (M) SECIM.misafir = { ad: "", dt: "", yk: "", onay: false };
  // Yorum isteği açılış animasyonu başlamadan gönderilir; bekleme animasyonun arkasında kalır.
  CTL?.abort(); CTL = new AbortController(); const t0 = performance.now(); let tIlk = null;
  const LIVE = window.__LIVE = { id, text: "", bitti: false };
  okumaIste({ D: DT, A: At, Dy: D, Ay: A, dil: aktifDil(), yerel, profil: P, picks, mod, gecmis: onceki, signal: CTL.signal, onText: text => {
    if (tIlk === null) tIlk = performance.now();
    LIVE.text = text; const out = $("#aiout"); if (out && LIVE.id === id) { out.innerHTML = mdAkan(text); oracleKapat(); }
  } }).then(r => {
    LIVE.bitti = true; const baslik = (r.text.match(/^#\s+(.+)$/m) || [])[1] || t("genel.okuma");
    store.updateGecmis(id, { metin: r.text, baslik, mod: r.mod, durum: "tamam", sure: { ilk: tIlk ? Math.round(tIlk - t0) : null, toplam: Math.round(performance.now() - t0) }, demo: !!r.demo });
    if (H.kullanici() && !r.demo) gecmisGonder(store.gecmis());
    if (location.hash === "#sonuc-" + id) { ortam.durdur(3); sis.surekli(0); viewSonuc(id, true); ses.tamam(); }
  }).catch(e => {
    LIVE.bitti = true; ortam.durdur(); sis.surekli(0); store.updateGecmis(id, { durum: "hata", hata: e instanceof OkumaHatasi ? e.message : t("hata.genel"), hataKod: e.kod });
    if (location.hash === "#sonuc-" + id) viewSonuc(id, true);
  });

  const ov = document.createElement("div"); ov.className = "reveal";
  ov.innerHTML = `<button class="btn ghost skip" id="atla">${t("acl.atla")}</button><div class="lab" id="rvl">${t("acl.etiket")}</div>
   <div class="rgrid">${picks.map((pk, i) => { const c = CARD[pk.kod]; return `<div class="rslot" style="--c:${TEMA[c.set].renk};--d:${i * 90}ms"><div class="box"><div class="c ${pk.o === "Y" ? "y" : ""}"><span class="back"></span>${face(c)}<span class="shine"></span></div></div><span class="p">${posAd(i)}</span></div>`; }).join("")}</div>
   <p class="cap" id="rvn" aria-live="polite"></p>
   <div class="gstage" id="gs"></div>`;
  document.body.appendChild(ov);
  let atla = false; $("#atla").onclick = () => { atla = true; };
  const bitir = () => { ov.remove(); if (LIVE.bitti) ortam.durdur(4); go("sonuc-" + id); };
  const cs = [...ov.querySelectorAll(".c")];
  await sleep(700);
  for (let i = 0; i < cs.length && !atla; i++) {
    const c = CARD[picks[i].kod]; cs[i].classList.add("open"); ses.cevir(i); titres(12);
    setTimeout(() => { sis.duman(cs[i], { n: 5, tepe: 0.4 }); kivilcimEl(cs[i], { n: 10, renk: TEMA[c.set].rgba, hiz: 50 }); }, 380);
    $("#rvn").innerHTML = `<span style="color:${TEMA[c.set].renk}">${posAd(i)}</span> · ${esc(c.ad)} <span class="muted">(${konum(picks[i].o).toLocaleLowerCase(yerelKod())})</span>`;
    await sleep(820);
  }
  if (atla) return bitir();
  // Koruyucu sahnesi
  await sleep(400); ov.classList.add("guardian");
  const T = TEMA[B.set], S = SET[B.set];
  $("#gs").innerHTML = `${koruyucuHTML(B.set, "big")}<div class="lab">${t("acl.koruyucu")}</div><h2 style="color:${T.renk}">${korAd(B.set)}</h2><p class="muted small">${S.diger} · ${mitAd(B.set)}</p><p class="soz">${korSoz(B.set)}</p>`;
  ses.koruyucu(); titres([20, 60, 30]);
  sis.acilis(2.4, 0.4); sis.surekli(0.8);
  setTimeout(() => { const g = $("#gs .guard"); if (g) { sis.duman(g, { n: 7, tepe: 0.35 }); kivilcimEl(g, { n: 24, renk: T.rgba, hiz: 70, omur: 2.2 }); } }, 500);
  for (let t = 0; t < 26 && !atla; t++) await sleep(100);
  bitir();
}

/* ---------- Sonuç ---------- */
const BEKLEME = A => [t("bek.1"), t("bek.2", { m: [...new Set(A.cs.map(c => mitAd(c.set)))].join(", ") }), t("bek.3"), t("bek.4", { a: posAd(0), b: posAd(5) }), t("bek.5")];
function oracleKapat() { const o = $("#oracle"); if (o && !o.classList.contains("hidden")) { o.classList.add("hidden"); clearInterval(BEKLE); } }
function viewSonuc(id, yenile) {
  chrome(true, "gecmis");
  const r = store.gecmis().find(x => x.id === id);
  if (!r) { $("#view").innerHTML = `<p class="muted">${t("sn.bulunamadi")}</p>`; return; }
  const A = analyze(D, r.picks, r.profil); const B = { ...baskinSet(A.cs), ...(r.koruyucu ? { set: r.koruyucu } : {}) };
  const T = TEMA[B.set], S = SET[B.set]; const adet = A.cs.filter(c => c.set === B.set).length;
  const live = window.__LIVE?.id === id ? window.__LIVE.text : ""; const metin = r.metin || live; const akiyor = !r.metin && r.durum === "bekliyor";
  document.documentElement.style.setProperty("--set", T.renk);
  $("#barGuard").innerHTML = koruyucuHTML(B.set, "tiny");
  const W = CONFIG.MEDIA.waitingVideo;
  $("#view").innerHTML = `
   <section class="ghero" style="--c:${T.renk}">${koruyucuHTML(B.set, "hero")}
    <div class="stack" style="gap:4px"><div class="lab">${t("sn.koruyucun")}</div><h2 style="color:${T.renk}">${korAd(B.set)}</h2>
     <span class="small muted">${S.diger} · ${mitAd(B.set)}</span>
     <span class="small">${adet >= 2 && B.neden !== "kader" ? t("sn.cogunluk", { n: adet, set: S.diger }) : t(new Set(A.cs.map(c => c.set)).size === 6 ? "sn.altiFarkli" : "sn.esit", { kader: posAd(5) })}</span>
     <p class="soz">${korSoz(B.set)}</p></div></section>
   <section class="stack"><div class="lab">${new Date(r.tarih).toLocaleString(yerelKod(), { dateStyle: "long", timeStyle: "short" })} · ${okumaAd(r.mod)}${r.misafir ? ` · ${esc(t("mf.etiket", { ad: r.misafir.ad || t("mf.isimsiz") }))} · ${burcAd(r.misafir.burc)}` : ""}</div>
    <div class="strip">${A.cs.map((c, i) => `<button data-k="${c.kod}" data-i="${i}" style="--c:${TEMA[c.set].renk}"><span class="p">${posAd(i)}</span><span class="bx"><span class="t ${c.o === "Y" ? "y" : ""}">${face(c)}</span></span><span class="n">${esc(c.ad)}</span></button>`).join("")}</div></section>
   <section class="panel reading-text">
    <div class="oracle ${metin || r.durum !== "bekliyor" ? "hidden" : ""}" id="oracle">${W ? `<video src="${W}" autoplay muted loop playsinline></video>` : SIGIL("small spin")}<span id="obek">${t("bek.1")}</span></div>
    <div class="aiout" id="aiout">${metin ? (akiyor ? mdAkan(metin) : md(metin)) : ""}</div>
    <div class="feragat ${r.metin ? "" : "hidden"}" id="feragat"><span>${t("sn.sorumluluk")}</span>${r.metin ? `<button class="bildir" id="bildir" ${r.bildirildi ? "disabled" : ""}>${t(r.bildirildi ? "bd.bildirildi" : "bd.dugme")}</button>` : ""}</div>
    ${r.durum === "hata" ? `<p class="note" style="border-color:var(--warn)">${esc(r.hata)}</p>` : ""}
    ${DEV() && r.sure ? `<p class="small muted" style="margin-top:12px">${t("sn.sure", { ilk: (r.sure.ilk / 1000 || 0).toFixed(1), top: (r.sure.toplam / 1000).toFixed(1) })}${r.demo ? " · demo" : ""}</p>` : ""}
   </section>
   <section class="panel stack"><div class="lab">${t("sn.harita")}</div>
    <div class="row small">${Object.entries(A.elc).map(([e, n]) => `<span class="chip el-${e}">${elAd(e)} ${n}</span>`).join("")}<span class="chip">${t("sn.dikYat", { d: A.dik, y: 6 - A.dik })}</span></div>
    ${A.anaTema.length ? `<div class="row small">${A.anaTema.map(x => `<span class="chip">${tv("tag", x.t)} ×${x.n}</span>`).join("")}</div>` : ""}
    ${A.kopru.length ? `<div class="small"><span class="muted">${t("sn.kopruler")}</span> ${A.kopru.map(k => `${tv("motif", k.m)} (${k.l.map(c => mitAd(c.set)).filter((v, i, a) => a.indexOf(v) === i).join(" + ")})`).join(" · ")}</div>` : ""}
    <p class="small muted">${t("sn.dokun")}</p></section>
   <a class="btn block" href="#ana">${t("sn.anaDon")}</a>`;
  $$(".strip button").forEach(b => b.onclick = () => kartDetay(b.dataset.k, A.cs[+b.dataset.i], +b.dataset.i));
  $("#bildir")?.addEventListener("click", () => bildirPenceresi(r));
  if (!metin && r.durum === "bekliyor") { const L = BEKLEME(A); let n = 0; clearInterval(BEKLE); BEKLE = setInterval(() => { const e = $("#obek"); if (!e) return clearInterval(BEKLE); e.classList.remove("swap"); void e.offsetWidth; e.textContent = L[++n % L.length]; e.classList.add("swap"); }, 2200); }
  if (!yenile) { const g = $(".ghero .guard"); g && setTimeout(() => kivilcimEl(g, { n: 10, renk: T.rgba, hiz: 40, omur: 2 }), 350); }
  if (!metin && r.durum === "bekliyor") sis.surekli(0.35);
}

/* ---------- Kart detayı ---------- */
function kartDetay(kod, okumadaki, i) {
  const c = CARD[kod], s = SET[c.set];
  const o = okumadaki?.o; const pz = okumadaki && c.poz ? c.poz[POS[i].ad] : null;
  const anlam = x => esc(x) || ceviriNot();
  openDialog(`<div class="lab" style="color:${TEMA[c.set].renk}">${setAd(s)} · ${mitAd(c.set)}</div><h2>${esc(c.ad)}</h2>`, `
   <div class="dcard">${face(c)}<div class="stack"><div class="row small"><span class="chip">${gezAd(c.gezegen)}</span><span class="chip">${burcAd(c.burc)}</span><span class="chip el-${c.element}">${elAd(c.element)}</span></div>
    ${o ? `<div class="lab">${posAd(i)} · ${konum(o)}</div>${pz ? `<p class="read" style="font-style:italic">${esc(o === "D" ? pz.D : pz.Y)}</p>` : `<p class="small muted">${esc(o === "D" ? c.dAnahtar : c.yAnahtar)}</p>`}` : `<p class="small muted">${esc(c.dAnahtar)} · ${esc(c.yAnahtar)}</p>`}</div></div>
   ${o ? `<div><div class="lab">${t("kd.anlam", { k: konum(o) })}</div><p class="read">${anlam(o === "D" ? c.dAnlam : c.yAnlam)}</p></div>` :
     `<div><div class="lab">${konum("D")} · ${esc(c.dAnahtar)}</div>${c.dAnlam ? `<p class="read">${esc(c.dAnlam)}</p>` : ""}</div><div><div class="lab">${konum("Y")} · ${esc(c.yAnahtar)}</div>${c.yAnlam ? `<p class="read">${esc(c.yAnlam)}</p>` : ""}</div>`}
   <div class="mit" style="border-color:${TEMA[c.set].renk}"><div class="lab">${t("kd.mitBag")}</div><div class="row small">${c.mitFigur.map(f => `<span class="chip">${esc(f)}</span>`).join("")}</div>
    ${c.mitDers ? `<p class="read">${esc(c.mitDers)}</p><p class="small"><span class="muted">${t("kd.dikkat")}</span> ${esc(c.mitDikkat)}</p>` : ""}</div>
   ${c.mitGercek ? `<div><div class="lab">${t("kd.kaynak")}</div><p class="read small">${esc(c.mitGercek)}</p></div>` : ""}
   ${c.hikaye ? `<div><div class="lab">${t("kd.hikaye")}</div><p class="read">${esc(c.hikaye)}</p></div>` : ""}
   ${o || !c.poz ? "" : `<div style="overflow-x:auto"><table class="t"><tr><th>${t("kd.pozisyon")}</th><th>${konum("D")}</th><th>${konum("Y")}</th></tr>${POS.map((p, j) => `<tr><td>${posAd(j)}</td><td>${esc(c.poz[p.ad]?.D)}</td><td>${esc(c.poz[p.ad]?.Y)}</td></tr>`).join("")}</table></div>`}
   ${c.ceviriEksik?.length ? ceviriNot() : ""}`);
}

/* ---------- Kütüphane ---------- */
function viewKartlar() {
  chrome(true, "kartlar");
  $("#view").innerHTML = `<h2>${t("kt.baslik")}</h2><p class="small muted">${t("kt.alt")}</p>` + D.sets.map(s => { const T = TEMA[s.id]; return `<section class="setsec" style="--c:${T.renk}">
    <header>${koruyucuHTML(s.id, "mini")}<div class="stack" style="gap:2px;flex:1"><h3>${s.diger}</h3><span class="small muted">${aktifDil() === "tr" ? s.ad + " · " : ""}${mitAd(s.id)} · ${korAd(s.id)}</span></div></header>
    <details><summary class="small">${t("kt.cerceve")}</summary>${s.cerceve ? `<p class="read small" style="margin-top:8px">${esc(s.cerceve)}</p>` : ceviriNot()}</details>
    <div class="lgrid">${D.cards.filter(c => c.set === s.id).map(c => `<button class="lcard" data-k="${c.kod}">${face(c)}<span class="nm">${esc(c.ad)}</span></button>`).join("")}</div></section>`; }).join("");
  $$(".lcard").forEach(b => b.onclick = () => kartDetay(b.dataset.k));
}

/* ---------- Geçmiş ---------- */
function viewGecmis() {
  chrome(true, "gecmis"); const g = store.gecmis();
  $("#view").innerHTML = `<h2>${t("gc.baslik")}</h2>${g.length ? `<div class="hist">${g.map(histItem).join("")}</div>` : `<p class="muted">${t("gc.bos")}</p>`}
   <p class="note">${t("gc.not")}</p>`;
}

/* ---------- Profil ---------- */
const tarihKisa = iso => { try { return new Date(iso).toLocaleDateString(yerelKod(), { day: "numeric", month: "short" }); } catch { return ""; } };
function profilIstatistik() {
  const g = store.gecmis().filter(r => !r.misafir && r.durum === "tamam");
  const gunler = new Set(g.map(r => zamanAnahtarlari(new Date(r.tarih)).gun));
  let seri = 0; const d = new Date();
  if (!gunler.has(zamanAnahtarlari(d).gun)) d.setDate(d.getDate() - 1);
  while (gunler.has(zamanAnahtarlari(d).gun)) { seri++; d.setDate(d.getDate() - 1); }
  const n = {}; g.forEach(r => (r.picks || []).forEach(x => n[x.kod] = (n[x.kod] || 0) + 1));
  const en = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  return { okuma: g.length, seri, kart: en && en[1] > 1 ? CARD[en[0]] : null };
}
function hesapSatiri() {
  if (!H.hesapAcik() || MODE !== "sunucu") return "";
  const u = H.kullanici();
  if (!u) return `<details class="ayar"><summary><span>${t("hs.baslik")}</span><span class="muted small">${t("pr.hesapYok")}</span></summary><div class="stack ayar-ic">
    <p class="small muted">${t("hs.aciklama")}</p>
    <button class="btn google block" id="hsG">${GOOGLE_SVG}${t("gr.google")}</button>
    <button class="btn block" id="hsAc">✉︎ ${t("gr.eposta")}</button></div></details>`;
  const gizli = String(u.email || "").replace(/^(.)(.*)(@.*)$/, (m, a, b, c) => a + "•••" + c);
  return `<details class="ayar"><summary><span>${t("hs.baslik")}</span><span class="muted small">${esc(gizli)}${H.googleHesabi() ? " · Google" : ""}</span></summary><div class="stack ayar-ic">
    <b style="word-break:break-all">${esc(u.email)}</b>
    ${u.emailVerified || H.googleHesabi() ? "" : `<p class="small muted">${t("hs.dogrulanmadi")}</p><div class="row"><button class="btn" id="hsDgT">${t("hs.dogrulaTekrar")}</button><button class="btn ghost" id="hsDgY">${t("hs.dogruladim")}</button></div>`}
    <button class="btn ghost" id="hsCik">${t("hs.cikis")}</button>
    <button class="btn ghost small" id="hsSil">${t("hs.sil")}</button><div id="hsSilOnay"></div></div></details>`;
}
function hesapOlaylari() {
  const hata = e => toast(t(H.hataAnahtari(e)));
  $("#hsAc")?.addEventListener("click", () => hesapPenceresi("giris", () => girisSonrasi(true, "profil")));
  $("#hsG")?.addEventListener("click", () => googleGiris(() => girisSonrasi(true, "profil")));
  $("#hsDgT")?.addEventListener("click", async () => { try { await H.dogrulamaGonder(aktifDil()); toast(t("hs.dogrulaGonderildi")); } catch (e) { hata(e); } });
  $("#hsDgY")?.addEventListener("click", async () => { try { await H.dogrulamaYenile(); route(); } catch (e) { hata(e); } });
  $("#hsCik")?.addEventListener("click", async () => { await H.cikisYap(); store.setKatman("ucretsiz"); store.setBitis(null); toast(t("hs.cikildi")); route(); });
  $("#hsSil")?.addEventListener("click", () => {
    $("#hsSilOnay").innerHTML = `<p class="small">${t("hs.silUyari")}</p>${H.googleHesabi() ? "" : `<label class="f">${t("hs.sifre")}<input id="hsSilP" type="password" autocomplete="current-password"></label>`}
      <div class="row"><button class="btn primary" id="hsSilE">${t("pr.silEvet")}</button><button class="btn ghost" id="hsSilH">${t("genel.vazgec")}</button></div>`;
    $("#hsSilE").onclick = async () => {
      $("#hsSilE").disabled = true;
      try { await H.yenidenDogrula($("#hsSilP")?.value); await hesapVerisiSil(); await H.hesabiSil(); await H.cikisYap().catch(() => {});
        store.hepsiniSil(); toast(t("hs.silindi")); go("hosgeldin"); }
      catch (e) { hata(e); $("#hsSilE").disabled = false; }
    };
    $("#hsSilH").onclick = () => $("#hsSilOnay").innerHTML = "";
  });
}
// Giriş / kayıt penceresi (e-posta); en üstte Google ile devam seçeneği
function hesapPenceresi(tur = "giris", sonra) {
  const kayit = tur === "kayit";
  openDialog(`<div class="lab">${t("hs.baslik")}</div><h2>${t(kayit ? "hs.kayit" : "hs.giris")}</h2>`, `<form class="stack" id="hsF" style="gap:12px" novalidate>
    <button type="button" class="btn google block" id="hsGo">${GOOGLE_SVG}${t("gr.google")}</button><div class="ya">${t("gr.yada")}</div>
    <label class="f">${t("hs.eposta")}<input id="hsE" type="email" autocomplete="email" inputmode="email" required></label>
    <label class="f">${t("hs.sifre")}<input id="hsP" type="password" autocomplete="${kayit ? "new-password" : "current-password"}" minlength="8" required>${kayit ? `<span class="small muted">${t("hs.sifreKural")}</span>` : ""}</label>
    ${kayit ? `<label class="f">${t("hs.sifreTekrar")}<input id="hsP2" type="password" autocomplete="new-password" minlength="8" required></label>` : ""}
    <label class="check"><input type="checkbox" id="hsH" checked> ${t("hs.hatirla")}</label>
    <p class="small" id="hsMsg" role="alert" style="color:var(--warn)"></p>
    <button class="btn primary block" id="hsOk">${t(kayit ? "hs.kayit" : "hs.giris")}</button>
    ${kayit ? `<p class="small muted">${t("hs.kosul", { btn: `<button type="button" class="chip" id="hsKs" style="display:inline;padding:0 6px">${t("hk.kosullar")}</button>` })}</p>` : `<button type="button" class="btn ghost small" id="hsUn">${t("hs.unuttum")}</button>`}
    <button type="button" class="btn ghost block" id="hsGec">${t(kayit ? "hs.girisGec" : "hs.kayitGec")}</button></form>`);
  const msg = m => $("#hsMsg").textContent = m || "";
  $("#hsGo").onclick = async () => { $("#hsGo").disabled = true; $("#dlg").close(); await googleGiris(sonra); };
  $("#hsGec").onclick = () => hesapPenceresi(kayit ? "giris" : "kayit", sonra);
  $("#hsKs")?.addEventListener("click", () => hukukMetni("kosullar"));
  $("#hsUn")?.addEventListener("click", async () => { const e = $("#hsE").value.trim(); if (!e) return msg(t("hs.hata.eposta"));
    try { await H.sifreSifirla(e, aktifDil()); msg(""); toast(t("hs.sifirlaGonderildi")); } catch (er) { msg(t(H.hataAnahtari(er))); } });
  $("#hsF").onsubmit = async ev => {
    ev.preventDefault(); const e = $("#hsE").value.trim(), pw = $("#hsP").value, hatirla = $("#hsH").checked;
    if (!/^\S+@\S+\.\S+$/.test(e)) return msg(t("hs.hata.eposta"));
    if (pw.length < 8) return msg(t("hs.hata.zayif"));
    if (kayit && pw !== $("#hsP2").value) return msg(t("hs.sifreUyusmuyor"));
    $("#hsOk").disabled = true; msg("");
    try {
      if (kayit) { await H.kayitOl(e, pw, { dil: aktifDil(), hatirla }); toast(t("hs.olusturuldu")); }
      else { await H.girisYap(e, pw, { dil: aktifDil(), hatirla }); toast(t("hs.girildi")); }
      $("#dlg").close(); await hakDurumu(); sonra ? await sonra() : route();
    } catch (er) { msg(t(H.hataAnahtari(er))); $("#hsOk").disabled = false; }
  };
}
function testOkuma() { try { return localStorage.getItem("logos.testOkuma") || ""; } catch { return ""; } }
/* ---------- Hediye kodu ---------- */
const tarihYaz = iso => { try { return new Date(iso).toLocaleDateString(yerelKod(), { day: "numeric", month: "long", year: "numeric" }); } catch { return ""; } };
function hediyeKutusu() {
  if (MODE !== "sunucu") return "";
  return `<details class="hediye"><summary class="small">${t("hd.baslik")}</summary>
    <div class="row" style="gap:8px;margin-top:8px"><input id="hdK" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${t("hd.yer")}" style="flex:1;min-width:0"><button class="btn" id="hdB">${t("hd.btn")}</button></div>
    <p class="small" id="hdM" role="status"></p></details>`;
}
function hediyeOlay(yenile) {
  const b = $("#hdB"); if (!b) return;
  b.onclick = async () => {
    const kod = $("#hdK").value.trim(); if (!kod) return;
    const eski = store.kod(); b.disabled = true; $("#hdM").textContent = "…";
    store.setKod(kod); const h = await hakDurumu(); b.disabled = false;
    if (h.cevrimdisi) { store.setKod(eski); $("#hdM").textContent = t("hd.baglanti"); return; }
    if (h.katman && h.katman !== "ucretsiz" && (h.hediye || h.bitis || h.tamErisim)) {
      ses.tamam?.(); toast(h.bitis ? t("hd.tamam", { k: katmanAd(h.katman), t: tarihYaz(h.bitis) }) : t("pr.katman", { k: katmanAd(h.katman) })); yenile();
    } else { store.setKod(eski); $("#hdM").textContent = t("hd.gecersiz"); }
  };
}

function viewProfil(alt) {
  chrome(true, "profil");
  if (alt === "duzenle") return viewProfilForm();
  const p = store.profil(); const k = store.katman(); const ef = efektAyar();
  const kor = kullaniciKoruyucu(p), st = profilIstatistik(), pz = !!p.pazarlama?.onay, u = H.kullanici();
  const gelistirici = !DEV() ? "" : `<section class="panel stack"><div class="lab">${t("mod." + MODE)}</div>
    ${MODE === "sunucu" ? `<label class="f">${t("pr.testKod")}<input id="kod" value="${esc(store.kod())}" placeholder="${t("pr.testKodYer")}"></label><button class="btn" id="kodK">${t("pr.kodUygula")}</button>`
      : `<label class="f">${t("pr.testKatman", { mod: t("mod." + MODE) })}<select id="tk">${Object.keys(KATMANLAR).map(id => `<option value="${id}" ${id === k ? "selected" : ""}>${katmanAd(id)}</option>`).join("")}</select></label>`}
    <label class="f">Okuma türü (test)<select id="tOk">${[["", "Plana göre"], ["kisa", "Kısa"], ["tam", "Tam"], ["derin", "Derin"]].map(([v, a]) => `<option value="${v}" ${v === testOkuma() ? "selected" : ""}>${a}</option>`).join("")}</select></label>
    <button class="btn ghost" id="hakSifir">${t("pr.hakSifirla")}</button></section>`;
  const uc = [["☉", p.burc], ["☾", p.ay], ["↑", p.yk]].filter(x => x[1]).map(x => `${x[0]} ${burcAd(x[1])}`).join(" · ");
  $("#view").innerHTML = `
   <section class="phero" style="--kc:${TEMA[kor].renk}">
     <div class="phero-isik"></div><img class="phero-kor" src="${korGorsel(kor)}" alt="${esc(korAd(kor))}">
     <a class="chip phero-duz" href="#profil-duzenle">✎ ${t("pr.duzenle")}</a>
     <div class="phero-ic"><div class="phero-av">${GLIF[p.burc] || "✦"}</div>
       <h2>${esc(p.ad || t("pr.isimsiz"))}</h2><p class="small muted">${uc}</p>
       <span class="pill ${k}">◆ ${katmanAd(k)}${k !== "ucretsiz" && store.bitis() ? " · " + t("pr.kadar", { t: tarihKisa(store.bitis()) }) : ""}</span>
       <p class="small phero-soz">“${esc(korSoz(kor))}”<br><span class="muted">— ${esc(korAd(kor))}</span></p></div></section>
   <section class="pstat">
     <div><b data-say="${st.okuma}">0</b><span>${t("pr.stOkuma")}</span></div>
     <div><b data-say="${st.seri}">0</b><span>${t("pr.stSeri")}</span></div>
     <div>${st.kart ? `<b class="kucuk">${esc(st.kart.ad)}</b>` : `<b class="kucuk">—</b>`}<span>${t("pr.stKart")}</span></div></section>
   ${u || !H.hesapAcik() || MODE !== "sunucu" ? "" : `<section class="panel row hesapcagri"><div class="stack" style="gap:2px"><b>${t("pr.hesapBaslik")}</b><span class="small muted">${t("pr.hesapAlt")}</span></div><button class="btn google" id="hsG2">${GOOGLE_SVG}</button></section>`}
   <section class="panel ayarlar">
     ${hesapSatiri()}
     <details class="ayar"><summary><span>${t("pr.planHediye")}</span><span class="muted small">${katmanAd(k)}</span></summary><div class="stack ayar-ic">
       ${k !== "ucretsiz" && store.bitis() ? `<span class="small muted">${t("hd.bitis", { t: tarihYaz(store.bitis()) })}</span>` : ""}
       <a class="btn" href="#premium">${t("pr.planlar")}</a>${hediyeKutusu()}</div></details>
     ${H.kullanici() ? `<details class="ayar"><summary><span>${t("pr.bildirim")}</span><span class="muted small">${t(pz ? "pr.acik" : "pr.kapali")}</span></summary><div class="stack ayar-ic">
       <label class="check"><input type="checkbox" id="pzK" ${pz ? "checked" : ""}> <span>${t("kr.pazarlama")}</span></label>
       <p class="small muted">${t("pr.bildirimNot")}</p></div></details>` : ""}
     <details class="ayar"><summary><span>${t("pr.dilSes")}</span><span class="muted small">${DILLER[aktifDil()].ad}</span></summary><div class="stack ayar-ic">
       <div class="row" style="justify-content:space-between"><b>${DILLER[aktifDil()].ad}</b><button class="btn" id="dilB">${t("pr.dilDegistir")}</button></div>
       <p class="small muted">${t("pr.dilNot")}</p>
       <label class="check"><input type="checkbox" id="efS" ${ef.ses ? "checked" : ""}> ${t("pr.ses")}</label>
       <label class="check"><input type="checkbox" id="efT" ${ef.titresim ? "checked" : ""}> ${t("pr.titresim")}</label></div></details>
     <a class="ayar link" href="#rehber"><span>${t("pr.rehber")}</span><span class="muted">›</span></a>
     <details class="ayar"><summary><span>${t("pr.hukukSil")}</span></summary><div class="stack ayar-ic">
       ${["aydinlatma", "gizlilik", "kosullar"].map(x => `<button class="btn ghost" data-hk="${x}">${t("hk." + x)}</button>`).join("")}
       <button class="btn ghost" id="sil">${t("pr.sil")}</button><div id="silOnay"></div></div></details>
   </section>
   ${gelistirici}
   <p class="small muted" style="text-align:center">${esc(CONFIG.APP_NAME)} · ${t("pr.surum", { v: CONFIG.VERSION })}</p>`;
  // sayılar yükselerek gelir
  $$(".pstat b[data-say]").forEach(b => { const hedef = +b.dataset.say; if (azHareket() || !hedef) { b.textContent = hedef; return; }
    let i = 0; const adim = Math.max(1, Math.ceil(hedef / 20)); const z = setInterval(() => { i = Math.min(hedef, i + adim); b.textContent = i; if (i >= hedef) clearInterval(z); }, 40); });
  $("#dilB").onclick = dilSecici;
  $$("[data-hk]").forEach(b => b.onclick = () => hukukMetni(b.dataset.hk));
  hesapOlaylari();
  $("#hsG2")?.addEventListener("click", () => googleGiris(() => girisSonrasi(true, "profil")));
  $("#pzK")?.addEventListener("change", e => { const n = { ...store.profil(), pazarlama: { onay: e.target.checked, tarih: e.target.checked ? new Date().toISOString() : "", surum: PAZ_SURUM } };
    store.setProfil(n); profilGonder(n); toast(t(e.target.checked ? "pr.pzAcildi" : "pr.pzKapandi"));
    e.target.closest("details").querySelector("summary .small").textContent = t(e.target.checked ? "pr.acik" : "pr.kapali"); });
  $("#efS").onchange = e => { setEfekt("ses", e.target.checked); if (e.target.checked) ses.tamam(); };
  $("#efT").onchange = e => { setEfekt("titresim", e.target.checked); if (e.target.checked) titres(30); };
  $("#tk")?.addEventListener("change", e => { store.setKatman(e.target.value); chrome(true, "profil"); toast(t("pr.katmanSecildi", { k: katmanAd(e.target.value) })); });
  $("#hakSifir")?.addEventListener("click", () => { store.setHak({}); toast(t("pr.hakSifirlandi")); });
  hediyeOlay(() => viewProfil());
  $("#tOk")?.addEventListener("change", e => { try { localStorage.setItem("logos.testOkuma", e.target.value); } catch {} });
  $("#kodK")?.addEventListener("click", async () => { store.setKod($("#kod").value.trim()); const h = await hakDurumu(); chrome(true, "profil"); toast(t("pr.katman", { k: katmanAd(h.katman) })); });
  $("#sil").onclick = () => { $("#silOnay").innerHTML = `<p class="small">${t(H.kullanici() ? "pr.silUyariHesap" : "pr.silUyari")}</p><div class="row"><button class="btn primary" id="silE">${t("pr.silEvet")}</button><button class="btn ghost" id="silH">${t("genel.vazgec")}</button></div>`;
    $("#silE").onclick = async () => { await H.cikisYap().catch(() => {}); store.hepsiniSil(); go("hosgeldin"); }; $("#silH").onclick = () => $("#silOnay").innerHTML = ""; };
}

/* ---------- Rehber ---------- */
function viewRehber() {
  chrome(true, "profil");
  const bolum = i => `<section class="rh"><div class="rhno" style="--c:${TEMA["S" + (((i - 1) % 6) + 1)].renk}">${i}</div><div class="stack" style="gap:6px"><h3>${t(`rh.${i}.b`)}</h3><p class="read">${t(`rh.${i}.m`)}</p></div></section>`;
  $("#view").innerHTML = `<section class="rhbas">${SIGIL("big")}<div class="lab">${t("rh.etiket")}</div><h2 class="glow">${t("rh.baslik")}</h2><p class="read soz">${t("rh.giris")}</p></section>
   <div class="stack" style="gap:18px">${Array.from({ length: 9 }, (_, i) => bolum(i + 1)).join("")}</div>
   <div class="setline" style="justify-content:center;margin:8px 0">${D.sets.map(s => `<span style="--c:${TEMA[s.id].renk}">${s.diger}</span>`).join("")}</div>
   <a class="btn block" href="#profil">${t("genel.kapat")}</a>`;
}

/* ---------- Planlar ---------- */
function viewPremium() {
  chrome(true, "profil"); const k = store.katman();
  // İlk aşamada hizmet yalnızca Türkiye'de: tüm dillerde TL fiyat (KDV dahil) gösterilir
  const fiyat = id => id === "ucretsiz" ? t("pm.ucretsiz") : t("pm.ay", { f: FIYAT_TR[id] });
  const tier = (id, best) => `<div class="tier ${best ? "best" : ""}"><div class="row" style="justify-content:space-between"><h3>${katmanAd(id)}</h3>${k === id ? `<span class="chip on">${t("pm.aktif")}</span>` : best ? `<span class="chip on">${t("pm.onerilen")}</span>` : ""}</div>
    <div class="pr">${fiyat(id)}</div><ul>${t("pm.oz." + id).split("|").map(o => `<li>${o}</li>`).join("")}</ul>
    ${id !== "ucretsiz" && k !== id && CONFIG.STORE_READY ? `<button class="btn ${best ? "primary" : ""} block" data-abone="${id}">${t("pm.aboneOl")}</button>` : ""}</div>`;
  $("#view").innerHTML = `<h2>${t("pm.baslik")}</h2>${tier("ucretsiz")}${tier("gumus")}${tier("altin", true)}${tier("elmas")}
   <section class="panel stack">${hediyeKutusu()}</section>
   <p class="small muted">${t("pm.notTR")}</p>`;
  hediyeOlay(() => viewPremium());
  $$("[data-abone]").forEach(b => b.onclick = () => {
    if (H.hesapAcik() && !H.kullanici()) { toast(t("pm.hesapGerek")); return hesapPenceresi("giris", () => girisSonrasi(true, "premium")); }
    // Google Play satın alma akışı Android sürümünde window.LogosOdeme.satinAl(planId) ile bağlanacak
    window.LogosOdeme?.satinAl?.(b.dataset.abone);
  });
}

/* ---------- Bölge dışı ---------- */
function viewBolge() {
  chrome(false);
  $("#view").innerHTML = `<section class="intro bolge">${SIGIL("big")}
    <h1 class="glow">${esc(CONFIG.APP_NAME)}</h1>
    <h2>${t("bl.baslik")}</h2><p class="muted" style="max-width:36ch">${t("bl.metin")}</p>
    <form class="stack" id="blF" style="gap:12px;width:100%;max-width:340px;text-align:start" novalidate>
      <label class="f">${t("hs.eposta")}<input id="blE" type="email" autocomplete="email" inputmode="email" required></label>
      <label class="check"><input type="checkbox" id="blO"> <span class="small">${t("bl.onay")}</span></label>
      <p class="small" id="blM" role="alert" style="color:var(--warn)"></p>
      <button class="btn primary block" id="blG" disabled>${t("bl.gonder")}</button>
      <p class="small muted">${t("bl.not", { btn: `<button type="button" class="chip" id="blK" style="display:inline;padding:0 6px">${t("hk.aydinlatma")}</button>` })}</p>
    </form>
    <details class="hediye" style="max-width:340px;width:100%;text-align:start"><summary class="small">${t("bl.kodVar")}</summary>
      <div class="row" style="gap:8px;margin-top:8px"><input id="blKod" autocomplete="off" autocapitalize="characters" spellcheck="false" style="flex:1;min-width:0"><button class="btn" id="blKodB">${t("hd.btn")}</button></div></details>
    <button class="chip dilchip" id="blD">🌐 ${DILLER[aktifDil()].ad}</button></section>`;
  $("#blKodB").onclick = () => { const k = $("#blKod").value.trim(); if (!k) return; store.setKod(k); location.reload(); };
  const kontrol = () => $("#blG").disabled = !($("#blO").checked && /^\S+@\S+\.\S+$/.test($("#blE").value.trim()));
  $("#blE").oninput = kontrol; $("#blO").onchange = kontrol;
  $("#blK").onclick = () => hukukMetni("aydinlatma"); $("#blD").onclick = dilSecici;
  $("#blF").onsubmit = async e => { e.preventDefault(); $("#blG").disabled = true;
    const r = await beklemeKaydet($("#blE").value.trim(), aktifDil()).catch(() => ({ tamam: false }));
    if (r.tamam) { $("#blF").innerHTML = `<p class="note">${t("bl.tesekkur")}</p>`; ses.tamam(); }
    else { $("#blM").textContent = t(r.kod === "cok_istek" ? "bl.cokIstek" : "bl.hata"); kontrol(); } };
}

/* ---------- İçerik bildirimi (Google Play yapay zekâ içerik politikası) ---------- */
function bildirPenceresi(r) {
  const N = ["uygunsuz", "yanlis", "zararli", "diger"]; let secim = null;
  openDialog(`<div class="lab">${t("bd.etiket")}</div><h2>${t("bd.baslik")}</h2>`, `<div class="stack" style="gap:12px">
    <p class="small muted">${t("bd.aciklama")}</p>
    <div class="row" id="bdN">${N.map(n => `<button type="button" class="chip" data-n="${n}">${t("bd.n." + n)}</button>`).join("")}</div>
    <label class="f">${t("bd.not")}<textarea id="bdT" maxlength="400" rows="3"></textarea></label>
    <button class="btn primary block" id="bdG" disabled>${t("bd.gonder")}</button></div>`);
  $$("#bdN button").forEach(b => b.onclick = () => { secim = b.dataset.n; $$("#bdN button").forEach(x => x.classList.toggle("on", x === b)); $("#bdG").disabled = false; });
  $("#bdG").onclick = async () => {
    $("#bdG").disabled = true;
    const s = await bildirGonder({ okuma: r.id, neden: secim, not: $("#bdT").value.trim(), metin: r.metin, picks: r.picks, dil: r.dil, mod: r.mod }).catch(() => ({ tamam: false }));
    if (s.tamam) { store.updateGecmis(r.id, { bildirildi: true }); $("#dlg").close(); toast(t("bd.tesekkur")); const b = $("#bildir"); if (b) { b.textContent = t("bd.bildirildi"); b.disabled = true; } }
    else { toast(t("bd.hata")); $("#bdG").disabled = false; }
  };
}

/* ---------- Başlat ---------- */
async function init() {
  document.title = CONFIG.APP_NAME;
  gokyuzu(); sis.acilis();
  await dilYukle();
  try { DT = await (await fetch("data/deste.json")).json(); } catch { $("#view").innerHTML = `<p class="muted">${t("hata.veri")}</p>`; return; }
  await dilUygula(aktifDil());
  $("#brand").innerHTML = `${CONFIG.MEDIA.logo ? `<img src="${CONFIG.MEDIA.logo}" alt="">` : SIGIL("logo")}<span>${esc(CONFIG.APP_NAME)}</span>`;
  setBack();
  MODE = await calismaModu();
  BOLGE = await bolgeDurumu();
  await Promise.race([H.hesapHazir(), sleep(4000)]);
  H.hesapDinle(() => { if (/^#(profil|premium)/.test(location.hash) && !$("#dlg").open) route(); });
  route();
  if ("serviceWorker" in navigator && location.protocol === "https:" && !window.claude && !window.Capacitor?.isNativePlatform?.()) { // Android uygulamasında dosyalar pakette, önbellek gerekmez
    // Yeni sürüm yüklendiğinde uygulama kendini bir kez yeniler (okuma sürüyorsa beklemez, bir sonraki açılışa kalır).
    // Veriler (profil, geçmiş, kodlar, geliştirici görünümü) cihazda kalır; güncelleme bunları silmez.
    let vardi = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!vardi) { vardi = true; return; }
      if (window.__LIVE && !window.__LIVE.bitti) return;
      location.reload();
    });
    navigator.serviceWorker.register("sw.js").then(reg => {
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
    }).catch(() => {});
  }
}
init();
