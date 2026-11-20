// Uygulamanın ekranları ve akışı.
import { CONFIG } from "../app.config.js";
import { KATMANLAR, OKUMALAR } from "../shared/katmanlar.js";
import { POS, SIGNS, SIGN, TAGS, NIYET, sunSign, analyze } from "../shared/motor.js";
import { store, zamanAnahtarlari } from "./store.js";
import { okumaIste, hakDurumu, calismaModu, OkumaHatasi } from "./ai.js";
import { ses, titres, gokyuzu, kivilcim, kivilcimEl, efektAyar, setEfekt, azHareket, sis, ortam } from "./fx.js";
import { TEMA, baskinSet, koruyucuHTML, koruyucuOnYukle, korAd, korSoz } from "./koruyucu.js";
import { t, tv, aktifDil, yerelKod, dilYukle, dilKaydet, desteBirlestir, kartCevirisi, metinler } from "./i18n.js";
import { DILLER, yerelIstem } from "../shared/diller.js";

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = ms => new Promise(r => setTimeout(r, azHareket() ? Math.min(ms, 60) : ms));
let D = null, DT = null, CARD = {}, SET = {}, MODE = "demo";
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
const ROUTES = { hosgeldin: viewHosgeldin, ana: viewAna, kartlar: viewKartlar, gecmis: viewGecmis, profil: viewProfil, premium: viewPremium, sonuc: viewSonuc };
let BEKLE = null, ILK = true;
function go(h) { if (location.hash === "#" + h) route(); else location.hash = h; }
function route() {
  const [r, arg] = (location.hash.slice(1) || "ana").split("-");
  if ($("#dlg").open) $("#dlg").close();
  document.querySelector(".reading")?.remove(); document.body.style.overflow = "";
  clearInterval(BEKLE);
  const p = store.profil();
  if (!p?.onay && r !== "hosgeldin") return go("hosgeldin");
  if (r !== "sonuc") ortam.durdur();
  sis.surekli(0);
  if (!ILK) { sis.gecis(); ses.gecis(); } ILK = false;
  (ROUTES[r] || viewAna)(arg); window.scrollTo(0, 0);
  const v = $("#view"); v.classList.remove("enter"); void v.offsetWidth; v.classList.add("enter");
}
addEventListener("hashchange", route);

/* ---------- Hoş geldin + profil ---------- */
function viewHosgeldin(adim) {
  chrome(false);
  if (adim !== "profil") {
    const M = CONFIG.MEDIA;
    $("#view").innerHTML = `<section class="intro">
      ${M.introVideo ? `<video src="${M.introVideo}" ${M.introPoster ? `poster="${M.introPoster}"` : ""} autoplay muted playsinline loop></video>` : SIGIL("big")}
      <h1 class="glow">${esc(CONFIG.APP_NAME)}</h1><p class="muted">${t("intro.slogan")}</p>
      <div class="setline">${D.sets.map(s => `<span style="--c:${TEMA[s.id].renk}">${s.diger}</span>`).join("")}</div>
      <p class="small muted" style="max-width:34ch">${t("intro.aciklama")}</p>
      <a class="btn primary" id="hBasla" href="#hosgeldin-profil" style="min-width:200px">${t("intro.basla")}</a>
      <button class="chip dilchip" id="hDil">🌐 ${DILLER[aktifDil()].ad}</button></section>`;
    $("#hBasla").addEventListener("click", () => ses.acilis());
    $("#hDil").onclick = dilSecici;
    return;
  }
  viewProfilForm(true);
}
function viewProfilForm(ilk) {
  const p = store.profil() || { ad: "", dt: "", yk: "", niyet: "genel" };
  $("#view").innerHTML = `<section class="stack" style="gap:16px;padding-top:${ilk ? 24 : 0}px">
    <h2>${ilk ? t("pf.baslikIlk") : t("pf.baslik")}</h2>
    <p class="small muted">${t("pf.aciklama")}</p>
    <label class="f">${t("pf.ad")}<input id="pAd" value="${esc(p.ad)}" autocomplete="given-name" maxlength="30"></label>
    <label class="f">${t("pf.dt")}<input id="pDt" type="date" value="${esc(p.dt)}" max="${new Date().toISOString().slice(0, 10)}"></label>
    <label class="f">${t("pf.yk")}<select id="pYk"><option value="">${t("pf.ykYok")}</option>${SIGNS.map(s => `<option value="${s[0]}" ${p.yk === s[0] ? "selected" : ""}>${burcAd(s[0])}</option>`).join("")}</select></label>
    <div id="pBurc" class="row"></div>
    ${ilk ? `<div class="stack" style="gap:12px;margin-top:6px">
      <label class="check"><input type="checkbox" id="c18"> ${t("pf.onay18")}</label>
      <label class="check"><input type="checkbox" id="cEg"> ${t("pf.onayEglence")}</label>
      <label class="check"><input type="checkbox" id="cKv"> <span>${t("pf.onayAktarim", { btn: `<button type="button" class="chip" id="kvkk" style="display:inline;padding:0 6px">${t("pf.onayMetinBtn")}</button>` })}</span></label>
    </div>` : ""}
    <button class="btn primary block" id="pKaydet" disabled>${ilk ? t("genel.devam") : t("genel.kaydet")}</button>
    ${ilk ? "" : `<a class="btn ghost block" href="#profil">${t("genel.vazgec")}</a>`}</section>`;
  const check = () => {
    const b = sunSign($("#pDt").value);
    $("#pBurc").innerHTML = b ? `<span class="small muted">${t("pf.gunesBurcun")}</span><span class="chip on">${burcAd(b)}</span><span class="chip el-${SIGN[b].el}">${elAd(SIGN[b].el)}</span><span class="chip">${t("pf.yonetici", { g: gezAd(SIGN[b].yon) })}</span>` : "";
    $("#pKaydet").disabled = !b || (ilk && !($("#c18").checked && $("#cEg").checked && $("#cKv").checked));
  };
  $$("#view input,#view select").forEach(e => e.addEventListener("input", check)); check();
  $("#kvkk")?.addEventListener("click", aydinlatma);
  $("#pKaydet").onclick = () => {
    const n = { ...p, ad: $("#pAd").value.trim(), dt: $("#pDt").value, yk: $("#pYk").value, burc: sunSign($("#pDt").value) };
    if (ilk) n.onay = { tarih: new Date().toISOString(), surum: "1", dil: aktifDil() };
    store.setProfil(n); ses.tamam(); toast(ilk ? (n.ad ? t("pf.hosgeldinAd", { ad: n.ad }) : t("pf.hosgeldin")) : t("pf.kaydedildi")); go(ilk ? "ana" : "profil");
  };
}
function aydinlatma() {
  const b = ["taslak", "sorumlu", "veriler", "amac", "aktarim", "haklar"].map(k => `<p>${t("gz." + k)}</p>`).join("");
  openDialog(`<div class="lab">${t("gz.etiket")}</div><h2>${t("gz.baslik")}</h2>`, `<div class="read small stack" style="gap:10px">${b}</div>`);
}

/* ---------- Dil seçimi ---------- */
function dilSecici() {
  openDialog(`<div class="lab">🌐</div><h2>${t("dil.baslik")}</h2>`, `<div class="dilliste">${Object.entries(DILLER).map(([k, v]) =>
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
let SECIM = { niyet: "genel", soru: "", derin: false };
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
     <div class="row"><span class="chip on">${burcAd(p.burc)}</span><span class="chip el-${SIGN[p.burc].el}">${elAd(SIGN[p.burc].el)}</span>${p.yk ? `<span class="chip">${t("ana.yukselen", { b: burcAd(p.yk) })}</span>` : ""}${MODE !== "sunucu" ? `<span class="chip warn">${t("mod." + MODE)}</span>` : ""}</div></div></section>
   <section class="panel hero">
     <div class="lab">${t("ana.etiket")}</div><h2>${t("ana.baslik")}</h2>
     <div class="stack"><span class="small muted">${t("ana.niyet")}</span><div class="row" id="niyet">${Object.keys(NIYET).map(k => `<button class="chip ${SECIM.niyet === k ? "on" : ""}" data-k="${k}">${t("niyet." + k)}</button>`).join("")}</div></div>
     <label class="f">${t("ana.soru")}<input id="soru" maxlength="160" value="${esc(SECIM.soru)}" placeholder="${t("ana.soruOrnek")}"></label>
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
  const h = await hakDurumu(); const k = KATMANLAR[h.katman];
  $("#quota").innerHTML = halka(h.gunKalan, h.gunluk, `${h.gunKalan}/${h.gunluk}`) + halka(h.haftaKalan, h.haftalik, `${h.haftaKalan}/${h.haftalik}`) + (k.okuma === "derin" ? halka(1, 1, "∞") : halka(h.derinKalan, h.derinAylik || 1, `${h.derinKalan}/${h.derinAylik}`));
  const var_ = h.gunKalan > 0 && h.haftaKalan > 0; $("#basla").disabled = !var_;
  if (k.okuma === "tam" && h.derinKalan > 0) {
    $("#derinBox").innerHTML = `<label class="check"><input type="checkbox" id="derin" ${SECIM.derin ? "checked" : ""}> ${t("ana.derinKullan", { n: h.derinKalan })}</label>`;
    $("#derin").onchange = e => SECIM.derin = e.target.checked;
  } else SECIM.derin = false;
  $("#hakNot").innerHTML = var_ ? t("ana.hakNot", { okuma: okumaAd(k.okuma), katman: katmanAd(h.katman) }) : `${t(h.gunKalan <= 0 ? "ana.hakBittiGun" : "ana.hakBittiHafta")} <a href="#premium" style="color:var(--blue)">${t("ana.premiumIle")}</a>`;
  $("#basla").onclick = () => okumaBaslat();
}
function histItem(r) {
  const d = new Date(r.tarih); const ks = r.koruyucu || baskinSet(r.picks.map(p => CARD[p.kod])).set;
  return `<a class="hitem" href="#sonuc-${r.id}" style="--c:${TEMA[ks].renk}">${koruyucuHTML(ks, "mini")}
   <div class="stack" style="gap:2px;flex:1"><span class="t">${esc(r.baslik || t("genel.okuma"))}</span><span class="small muted">${d.toLocaleDateString(yerelKod(), { day: "numeric", month: "long" })} · ${okumaAd(r.mod)}</span></div>
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
  const p = store.profil(); const P = { ...p, niyet: SECIM.niyet, soru: SECIM.soru.trim() };
  const k = KATMANLAR[store.katman()]; const mod = k.okuma === "tam" && SECIM.derin ? "derin" : k.okuma;
  const A = analyze(D, picks, P); const B = baskinSet(A.cs); koruyucuOnYukle(B.set);
  const At = analyze(DT, picks, P); const yerel = yerelIstem(aktifDil(), metinler(), kartCevirisi(), At.cs);
  const id = Date.now().toString(36);
  store.addGecmis({ id, tarih: new Date().toISOString(), picks, profil: { burc: P.burc, yk: P.yk, niyet: P.niyet, soru: P.soru }, mod, metin: "", baslik: "", durum: "bekliyor", koruyucu: B.set, dil: aktifDil() });
  // Yorum isteği açılış animasyonu başlamadan gönderilir; bekleme animasyonun arkasında kalır.
  CTL?.abort(); CTL = new AbortController(); const t0 = performance.now(); let tIlk = null;
  const LIVE = window.__LIVE = { id, text: "", bitti: false };
  okumaIste({ D: DT, A: At, Dy: D, Ay: A, dil: aktifDil(), yerel, profil: P, picks, mod, signal: CTL.signal, onText: text => {
    if (tIlk === null) tIlk = performance.now();
    LIVE.text = text; const out = $("#aiout"); if (out && LIVE.id === id) { out.innerHTML = mdAkan(text); oracleKapat(); }
  } }).then(r => {
    LIVE.bitti = true; const baslik = (r.text.match(/^#\s+(.+)$/m) || [])[1] || t("genel.okuma");
    store.updateGecmis(id, { metin: r.text, baslik, mod: r.mod, durum: "tamam", sure: { ilk: tIlk ? Math.round(tIlk - t0) : null, toplam: Math.round(performance.now() - t0) }, demo: !!r.demo });
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
   <section class="stack"><div class="lab">${new Date(r.tarih).toLocaleString(yerelKod(), { dateStyle: "long", timeStyle: "short" })} · ${okumaAd(r.mod)}</div>
    <div class="strip">${A.cs.map((c, i) => `<button data-k="${c.kod}" data-i="${i}" style="--c:${TEMA[c.set].renk}"><span class="p">${posAd(i)}</span><span class="bx"><span class="t ${c.o === "Y" ? "y" : ""}">${face(c)}</span></span><span class="n">${esc(c.ad)}</span></button>`).join("")}</div></section>
   <section class="panel reading-text">
    <div class="oracle ${metin || r.durum !== "bekliyor" ? "hidden" : ""}" id="oracle">${W ? `<video src="${W}" autoplay muted loop playsinline></video>` : SIGIL("small spin")}<span id="obek">${t("bek.1")}</span></div>
    <div class="aiout" id="aiout">${metin ? (akiyor ? mdAkan(metin) : md(metin)) : ""}</div>
    ${r.durum === "hata" ? `<p class="note" style="border-color:var(--warn)">${esc(r.hata)}</p>` : ""}
    ${r.sure ? `<p class="small muted" style="margin-top:12px">${t("sn.sure", { ilk: (r.sure.ilk / 1000 || 0).toFixed(1), top: (r.sure.toplam / 1000).toFixed(1) })}${r.demo ? " · demo" : ""}</p>` : ""}
   </section>
   <section class="panel stack"><div class="lab">${t("sn.harita")}</div>
    <div class="row small">${Object.entries(A.elc).map(([e, n]) => `<span class="chip el-${e}">${elAd(e)} ${n}</span>`).join("")}<span class="chip">${t("sn.dikYat", { d: A.dik, y: 6 - A.dik })}</span></div>
    ${A.anaTema.length ? `<div class="row small">${A.anaTema.map(x => `<span class="chip">${tv("tag", x.t)} ×${x.n}</span>`).join("")}</div>` : ""}
    ${A.kopru.length ? `<div class="small"><span class="muted">${t("sn.kopruler")}</span> ${A.kopru.map(k => `${tv("motif", k.m)} (${k.l.map(c => mitAd(c.set)).filter((v, i, a) => a.indexOf(v) === i).join(" + ")})`).join(" · ")}</div>` : ""}
    <p class="small muted">${t("sn.dokun")}</p></section>
   <a class="btn block" href="#ana">${t("sn.anaDon")}</a>`;
  $$(".strip button").forEach(b => b.onclick = () => kartDetay(b.dataset.k, A.cs[+b.dataset.i], +b.dataset.i));
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
function viewProfil(alt) {
  chrome(true, "profil");
  if (alt === "duzenle") return viewProfilForm(false);
  const p = store.profil(); const k = store.katman(); const ef = efektAyar();
  $("#view").innerHTML = `<h2>${t("pr.baslik")}</h2>
   <section class="panel stack"><div class="row" style="justify-content:space-between"><div class="stack" style="gap:2px"><b>${esc(p.ad || t("pr.isimsiz"))}</b><span class="small muted">${burcAd(p.burc)}${p.yk ? " · " + t("ana.yukselen", { b: burcAd(p.yk) }) : ""}</span></div><a class="btn" href="#profil-duzenle">${t("pr.duzenle")}</a></div></section>
   <section class="panel stack"><div class="lab">${t("pr.dil")}</div><div class="row" style="justify-content:space-between"><b>${DILLER[aktifDil()].ad}</b><button class="btn" id="dilB">${t("pr.dilDegistir")}</button></div>
    <p class="small muted">${t("pr.dilNot")}</p></section>
   <section class="panel stack"><div class="lab">${t("pr.uyelik")}</div><div class="row" style="justify-content:space-between"><b>${katmanAd(k)}</b><a class="btn" href="#premium">${t("pr.planlar")}</a></div>
    ${MODE === "sunucu" ? `<label class="f">${t("pr.testKod")}<input id="kod" value="${esc(store.kod())}" placeholder="${t("pr.testKodYer")}"></label><button class="btn" id="kodK">${t("pr.kodUygula")}</button>`
      : `<label class="f">${t("pr.testKatman", { mod: t("mod." + MODE) })}<select id="tk">${Object.keys(KATMANLAR).map(id => `<option value="${id}" ${id === k ? "selected" : ""}>${katmanAd(id)}</option>`).join("")}</select></label>
         <button class="btn ghost" id="hakSifir">${t("pr.hakSifirla")}</button>`}</section>
   <section class="panel stack"><div class="lab">${t("pr.sesTitresim")}</div>
    <label class="check"><input type="checkbox" id="efS" ${ef.ses ? "checked" : ""}> ${t("pr.ses")}</label>
    <label class="check"><input type="checkbox" id="efT" ${ef.titresim ? "checked" : ""}> ${t("pr.titresim")}</label></section>
   <section class="panel stack"><div class="lab">${t("pr.gizlilik")}</div><button class="btn ghost" id="kv">${t("gz.baslik")}</button>
    <button class="btn ghost" id="sil">${t("pr.sil")}</button><div id="silOnay"></div></section>
   <p class="small muted" style="text-align:center">${esc(CONFIG.APP_NAME)} · ${t("pr.surum", { v: CONFIG.VERSION })} · ${t("mod." + MODE)}</p>`;
  $("#dilB").onclick = dilSecici;
  $("#kv").onclick = aydinlatma;
  $("#efS").onchange = e => { setEfekt("ses", e.target.checked); if (e.target.checked) ses.tamam(); };
  $("#efT").onchange = e => { setEfekt("titresim", e.target.checked); if (e.target.checked) titres(30); };
  $("#tk")?.addEventListener("change", e => { store.setKatman(e.target.value); chrome(true, "profil"); toast(t("pr.katmanSecildi", { k: katmanAd(e.target.value) })); });
  $("#hakSifir")?.addEventListener("click", () => { store.setHak({}); toast(t("pr.hakSifirlandi")); });
  $("#kodK")?.addEventListener("click", async () => { store.setKod($("#kod").value.trim()); const h = await hakDurumu(); chrome(true, "profil"); toast(t("pr.katman", { k: katmanAd(h.katman) })); });
  $("#sil").onclick = () => { $("#silOnay").innerHTML = `<p class="small">${t("pr.silUyari")}</p><div class="row"><button class="btn primary" id="silE">${t("pr.silEvet")}</button><button class="btn ghost" id="silH">${t("genel.vazgec")}</button></div>`;
    $("#silE").onclick = () => { store.hepsiniSil(); go("hosgeldin"); }; $("#silH").onclick = () => $("#silOnay").innerHTML = ""; };
}

/* ---------- Premium ---------- */
// Türkiye fiyatları (KDV dahil). Diğer ülkelerde fiyat Google Play'den, yerel para birimiyle gelecek.
const FIYAT_TR = { premium: "79,99 TL", premiumPlus: "149,99 TL" };
function viewPremium() {
  chrome(true, "profil"); const k = store.katman();
  const fiyat = id => id === "ucretsiz" ? t("pm.ucretsiz") : aktifDil() === "tr" ? t("pm.ay", { f: FIYAT_TR[id] }) : t("pm.playFiyat");
  const tier = (id, best) => `<div class="tier ${best ? "best" : ""}"><div class="row" style="justify-content:space-between"><h3>${katmanAd(id)}</h3>${k === id ? `<span class="chip on">${t("pm.aktif")}</span>` : best ? `<span class="chip on">${t("pm.onerilen")}</span>` : ""}</div>
    <div class="pr">${fiyat(id)}</div><ul>${t("pm.oz." + id).split("|").map(o => `<li>${o}</li>`).join("")}</ul>
    ${id !== "ucretsiz" && k !== id ? `<button class="btn ${best ? "primary" : ""} block" ${CONFIG.STORE_READY ? "" : "disabled"}>${CONFIG.STORE_READY ? t("pm.aboneOl") : t("pm.yakinda")}</button>` : ""}</div>`;
  $("#view").innerHTML = `<h2>${t("pm.baslik")}</h2>${tier("ucretsiz")}${tier("premium", true)}${tier("premiumPlus")}
   <p class="small muted">${t(aktifDil() === "tr" ? "pm.notTR" : "pm.not")}</p>`;
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
  route();
  if ("serviceWorker" in navigator && location.protocol === "https:" && !window.claude) navigator.serviceWorker.register("sw.js").catch(() => {});
}
init();
