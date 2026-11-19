// Uygulamanın ekranları ve akışı.
import { CONFIG } from "../app.config.js";
import { KATMANLAR, OKUMALAR } from "../shared/katmanlar.js";
import { POS, SIGNS, SIGN, TAGS, NIYET, sunSign, analyze } from "../shared/motor.js";
import { store } from "./store.js";
import { okumaIste, hakDurumu, calismaModu, OkumaHatasi } from "./ai.js";

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = ms => new Promise(r => setTimeout(r, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms));
let D = null, CARD = {}, SET = {}, MODE = "demo";

/* ---------- Ortak parçalar ---------- */
const img = kod => CONFIG.CARD_IMAGE.replace("{kod}", kod);
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
const EMBLEM = `<svg viewBox="0 0 200 200" aria-hidden="true"><g fill="none" stroke="#8496e0" stroke-opacity=".6" stroke-width="1.5"><circle cx="100" cy="100" r="92"/><circle cx="100" cy="100" r="70" stroke-dasharray="3 6"/><circle cx="100" cy="100" r="50"/></g><g stroke="#d65a4f" stroke-width="4" stroke-linecap="round">${Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4, L = i % 2 ? 30 : 44; return `<line x1="${100 + 10 * Math.cos(a)}" y1="${100 + 10 * Math.sin(a)}" x2="${100 + L * Math.cos(a)}" y2="${100 + L * Math.sin(a)}"/>`; }).join("")}</g><circle cx="100" cy="100" r="6" fill="#d65a4f"/>${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<circle cx="${100 + 81 * Math.cos(a)}" cy="${100 + 81 * Math.sin(a)}" r="2.2" fill="#8496e0"/>`; }).join("")}</svg>`;
function setBack() {
  if (CONFIG.MEDIA.cardBack) { document.documentElement.style.setProperty("--back", `url("${CONFIG.MEDIA.cardBack}")`); return; }
  const rays = Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<line x1="${200 + 20 * Math.cos(a)}" y1="${320 + 20 * Math.sin(a)}" x2="${200 + (i % 2 ? 50 : 80) * Math.cos(a)}" y2="${320 + (i % 2 ? 50 : 80) * Math.sin(a)}"/>`; }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 640"><rect width="400" height="640" fill="#1a2150"/><rect x="18" y="18" width="364" height="604" rx="14" fill="none" stroke="#8496e0" stroke-opacity=".7" stroke-width="3"/><rect x="30" y="30" width="340" height="580" rx="10" fill="none" stroke="#8496e0" stroke-opacity=".35" stroke-width="2"/><g fill="none" stroke="#8496e0" stroke-opacity=".45" stroke-width="2"><circle cx="200" cy="320" r="120"/><circle cx="200" cy="320" r="150"/><circle cx="200" cy="320" r="96" stroke-dasharray="4 8"/></g><g stroke="#d65a4f" stroke-width="5" stroke-linecap="round">${rays}</g><circle cx="200" cy="320" r="10" fill="#d65a4f"/></svg>`;
  document.documentElement.style.setProperty("--back", `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
}
function chrome(show, route) {
  $("#bar").classList.toggle("hidden", !show); $("#tabbar").classList.toggle("hidden", !show);
  $$("#tabbar a").forEach(a => a.dataset.r === route ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  $("#app").classList.toggle("withbg", !!(route === "ana" && CONFIG.MEDIA.homeBackground));
  const k = KATMANLAR[store.katman()]; $("#katmanChip").textContent = k.ad; $("#katmanChip").className = "chip" + (store.katman() !== "ucretsiz" ? " on" : "");
}
function openDialog(h, b) { $("#dlgH").innerHTML = h; $("#dlgB").innerHTML = b; $("#dlg").showModal(); $("#dlgB").scrollTop = 0; }
$("#dlgX").onclick = () => $("#dlg").close();
$("#dlg").addEventListener("click", e => { if (e.target === $("#dlg")) $("#dlg").close(); });

/* ---------- Yönlendirme ---------- */
const ROUTES = { hosgeldin: viewHosgeldin, ana: viewAna, kartlar: viewKartlar, gecmis: viewGecmis, profil: viewProfil, premium: viewPremium, sonuc: viewSonuc };
function go(h) { if (location.hash === "#" + h) route(); else location.hash = h; }
function route() {
  const [r, arg] = (location.hash.slice(1) || "ana").split("-");
  if ($("#dlg").open) $("#dlg").close();
  document.querySelector(".reading")?.remove(); document.body.style.overflow = "";
  const p = store.profil();
  if (!p?.onay && r !== "hosgeldin") return go("hosgeldin");
  (ROUTES[r] || viewAna)(arg); window.scrollTo(0, 0);
}
addEventListener("hashchange", route);

/* ---------- Hoş geldin + profil ---------- */
function viewHosgeldin(adim) {
  chrome(false);
  if (adim !== "profil") {
    const M = CONFIG.MEDIA;
    $("#view").innerHTML = `<section class="intro">
      ${M.introVideo ? `<video src="${M.introVideo}" ${M.introPoster ? `poster="${M.introPoster}"` : ""} autoplay muted playsinline loop></video>` : `<div class="emblem">${EMBLEM}</div>`}
      ${M.logo ? `<img src="${M.logo}" alt="" style="width:72px;height:72px;object-fit:contain">` : ""}
      <h1>${esc(CONFIG.APP_NAME)}</h1><p class="muted">${esc(CONFIG.APP_SLOGAN)}</p>
      <p class="small muted" style="max-width:34ch">Altı mitolojiden otuz altı kart. Seçtiğin altı kart, burcunla birlikte sana özel bir yolculuk anlatır.</p>
      <a class="btn primary" href="#hosgeldin-profil" style="min-width:200px">Başla</a></section>`;
    return;
  }
  viewProfilForm(true);
}
function viewProfilForm(ilk) {
  const p = store.profil() || { ad: "", dt: "", yk: "", niyet: "genel" };
  $("#view").innerHTML = `<section class="stack" style="gap:16px;padding-top:${ilk ? 24 : 0}px">
    <h2>${ilk ? "Seni tanıyalım" : "Profilini düzenle"}</h2>
    <p class="small muted">Yorumlar burcuna göre kişiselleşir. Adın ve doğum tarihin yalnızca bu cihazda saklanır; yapay zekâya yalnızca burç bilgin gönderilir.</p>
    <label class="f">Adın (isteğe bağlı)<input id="pAd" value="${esc(p.ad)}" autocomplete="given-name" maxlength="30"></label>
    <label class="f">Doğum tarihin<input id="pDt" type="date" value="${esc(p.dt)}" max="${new Date().toISOString().slice(0, 10)}"></label>
    <label class="f">Yükselen burcun (biliyorsan)<select id="pYk"><option value="">Bilmiyorum</option>${SIGNS.map(s => `<option ${p.yk === s[0] ? "selected" : ""}>${s[0]}</option>`).join("")}</select></label>
    <div id="pBurc" class="row"></div>
    ${ilk ? `<div class="stack" style="gap:12px;margin-top:6px">
      <label class="check"><input type="checkbox" id="c18"> 18 yaşından büyüğüm.</label>
      <label class="check"><input type="checkbox" id="cEg"> Yorumların eğlence ve kişisel farkındalık amaçlı olduğunu, sağlık, hukuk ya da para konularında tavsiye yerine geçmediğini biliyorum.</label>
      <label class="check"><input type="checkbox" id="cKv"> <span><button type="button" class="chip" id="kvkk" style="display:inline;padding:0 6px">Aydınlatma metnini</button> okudum; burç bilgimin yorum için yurt dışındaki yapay zekâ hizmetine (Anthropic) aktarılmasına onay veriyorum.</span></label>
    </div>` : ""}
    <button class="btn primary block" id="pKaydet" disabled>${ilk ? "Devam" : "Kaydet"}</button>
    ${ilk ? "" : `<a class="btn ghost block" href="#profil">Vazgeç</a>`}</section>`;
  const check = () => {
    const b = sunSign($("#pDt").value);
    $("#pBurc").innerHTML = b ? `<span class="small muted">Güneş burcun</span><span class="chip on">${b}</span><span class="chip el-${SIGN[b].el}">${SIGN[b].el}</span><span class="chip">Yönetici: ${SIGN[b].yon}</span>` : "";
    $("#pKaydet").disabled = !b || (ilk && !($("#c18").checked && $("#cEg").checked && $("#cKv").checked));
  };
  $$("#view input,#view select").forEach(e => e.addEventListener("input", check)); check();
  $("#kvkk")?.addEventListener("click", aydinlatma);
  $("#pKaydet").onclick = () => {
    const n = { ...p, ad: $("#pAd").value.trim(), dt: $("#pDt").value, yk: $("#pYk").value, burc: sunSign($("#pDt").value) };
    if (ilk) n.onay = { tarih: new Date().toISOString(), surum: "1" };
    store.setProfil(n); toast(ilk ? `Hoş geldin${n.ad ? ", " + n.ad : ""}` : "Profil kaydedildi"); go(ilk ? "ana" : "profil");
  };
}
function aydinlatma() {
  openDialog(`<div class="lab">KVKK</div><h2>Aydınlatma metni (taslak)</h2>`, `<div class="read small stack" style="gap:10px">
    <p><b>Bu metin taslaktır;</b> yayından önce bir hukukçuya kontrol ettirilmelidir.</p>
    <p><b>Veri sorumlusu:</b> [Şirket unvanı, adresi, iletişim bilgisi].</p>
    <p><b>İşlenen veriler:</b> Adın (isteğe bağlı), doğum tarihin, yükselen burcun, niyet ve soru metnin, seçtiğin kartlar. Ad ve doğum tarihi yalnızca cihazında saklanır.</p>
    <p><b>Amaç:</b> Sana kişiselleştirilmiş kart yorumu üretmek ve kullanım haklarını yönetmek.</p>
    <p><b>Aktarım:</b> Yorum üretmek için burcun, niyetin, sorun ve kart seçimin yurt dışında hizmet veren yapay zekâ sağlayıcısına (Anthropic, ABD) iletilir. Bu aktarım açık rızana dayanır (6698 sayılı KVKK md. 9).</p>
    <p><b>Hakların:</b> KVKK md. 11 kapsamında verilerine erişme, düzeltme ve silinmesini isteme hakkın vardır. Profil sayfasındaki "Verilerimi sil" ile cihazdaki verilerini silebilirsin.</p></div>`);
}

/* ---------- Ana sayfa ---------- */
let SECIM = { niyet: "genel", soru: "", derin: false };
async function viewAna() {
  chrome(true, "ana"); const p = store.profil();
  if (CONFIG.MEDIA.homeBackground) $("#app").style.setProperty("--homebg", `url("${CONFIG.MEDIA.homeBackground}")`);
  const saat = new Date().getHours(); const selam = saat < 6 ? "İyi geceler" : saat < 12 ? "Günaydın" : saat < 18 ? "İyi günler" : "İyi akşamlar";
  const g = store.gecmis().slice(0, 3);
  $("#view").innerHTML = `
   <section class="stack"><p class="muted">${selam}${p.ad ? ", " + esc(p.ad) : ""}</p>
     <div class="row"><span class="chip on">${p.burc}</span><span class="chip el-${SIGN[p.burc].el}">${SIGN[p.burc].el}</span>${p.yk ? `<span class="chip">Yükselen ${p.yk}</span>` : ""}${MODE !== "sunucu" ? `<span class="chip warn">${MODE === "demo" ? "Demo modu" : "Önizleme modu"}</span>` : ""}</div></section>
   <section class="panel hero">
     <div class="lab">Bugünün okuması</div><h2>Altı kart seç, yolculuğunu gör</h2>
     <div class="stack"><span class="small muted">Niyetin</span><div class="row" id="niyet">${Object.entries(NIYET).map(([k, v]) => `<button class="chip ${SECIM.niyet === k ? "on" : ""}" data-k="${k}">${v}</button>`).join("")}</div></div>
     <label class="f">Sorun (isteğe bağlı)<input id="soru" maxlength="160" value="${esc(SECIM.soru)}" placeholder="ör. Bu değişime hazır mıyım?"></label>
     <div id="derinBox"></div>
     <div class="quota" id="quota"><div><b>–</b><span>Bugün</span></div><div><b>–</b><span>Bu hafta</span></div><div><b>–</b><span>Derin</span></div></div>
     <button class="btn primary block" id="basla" disabled>Kartları diz</button>
     <p class="small muted" id="hakNot"></p>
   </section>
   ${g.length ? `<section class="stack"><div class="row" style="justify-content:space-between"><h3>Son okumaların</h3><a class="small" href="#gecmis" style="color:var(--blue)">Tümü</a></div><div class="hist">${g.map(histItem).join("")}</div></section>` : ""}`;
  $$("#niyet button").forEach(b => b.onclick = () => { SECIM.niyet = b.dataset.k; $$("#niyet button").forEach(x => x.classList.toggle("on", x === b)); });
  $("#soru").oninput = e => SECIM.soru = e.target.value;
  const h = await hakDurumu(); const k = KATMANLAR[h.katman];
  const q = $$("#quota b"); q[0].textContent = `${h.gunKalan}/${h.gunluk}`; q[1].textContent = `${h.haftaKalan}/${h.haftalik}`; q[2].textContent = k.okuma === "derin" ? "Hepsi" : `${h.derinKalan}/${h.derinAylik}`;
  const var_ = h.gunKalan > 0 && h.haftaKalan > 0; $("#basla").disabled = !var_;
  if (k.okuma === "tam" && h.derinKalan > 0) {
    $("#derinBox").innerHTML = `<label class="check"><input type="checkbox" id="derin" ${SECIM.derin ? "checked" : ""}> Derin okuma kullan (bu ay ${h.derinKalan} hakkın var)</label>`;
    $("#derin").onchange = e => SECIM.derin = e.target.checked;
  } else SECIM.derin = false;
  $("#hakNot").innerHTML = var_ ? `${OKUMALAR[k.okuma].ad} · ${k.ad} katman` : `${h.gunKalan <= 0 ? "Bugünkü" : "Bu haftaki"} okuma hakkın doldu. <a href="#premium" style="color:var(--blue)">Premium ile günde 2 okuma</a>`;
  $("#basla").onclick = () => okumaBaslat();
}
function histItem(r) {
  const d = new Date(r.tarih);
  return `<a class="hitem" href="#sonuc-${r.id}"><div class="thumbs">${r.picks.slice(0, 4).map(p => `<img src="${img(p.kod)}" alt="">`).join("")}</div>
   <div class="stack" style="gap:2px"><span class="t">${esc(r.baslik || "Okuma")}</span><span class="small muted">${d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} · ${OKUMALAR[r.mod]?.ad || ""}</span></div></a>`;
}

/* ---------- Okuma akışı ---------- */
let CTL = null;
function okumaBaslat() {
  const order = [...D.cards.map(c => c.kod)].sort(() => Math.random() - .5);
  const picks = []; let pending = null;
  const ov = document.createElement("div"); ov.className = "reading"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Kart seçimi");
  ov.innerHTML = `<div class="rhead"><button class="btn ghost" id="rx" aria-label="Kapat">✕</button><h2 id="rt"></h2><div class="dots" id="rd">${POS.map(() => "<i></i>").join("")}</div></div>
   <div class="grid" id="rg">${order.map((k, i) => `<button class="gcard deal" data-k="${k}" aria-label="Kapalı kart ${i + 1}" style="--sx:${(2.5 - (i % 6)) * 28}px;--sy:${(2.5 - Math.floor(i / 6)) * 34}px;--sr:${(Math.random() * 30 - 15).toFixed(1)}deg;animation-delay:${i * 16}ms"><span class="badge"></span><span class="in"><span class="back"></span></span></button>`).join("")}</div>
   <div class="tray" id="rtr"></div>
   <div class="sheet" id="sh"><div class="lab" id="shp"></div><div style="font-family:var(--f-display);font-size:18px;margin-top:4px">Kartı nasıl koyuyorsun?</div>
     <div class="choice"><button id="chD"><span class="shape"></span>Dikey</button><button id="chY"><span class="shape h"></span>Yatay</button><button id="chX"><span class="shape" style="border-style:dashed;border-color:var(--dim)"></span>Vazgeç</button></div>
     <p class="small muted" style="margin-top:10px">Dikey: enerji açık ve harekette. Yatay: enerji içe dönük, olgunlaşıyor.</p></div>`;
  document.body.appendChild(ov); document.body.style.overflow = "hidden";
  const tray = () => {
    $("#rtr").innerHTML = POS.map((p, i) => { const pk = picks[i]; return `<div class="slot" title="${p.ad}">${pk ? `<div class="m ${pk.o === "Y" ? "y" : ""} ${i === picks.length - 1 ? "drop" : ""}"><span class="back"></span></div>` : p.ad.slice(0, 3)}</div>`; }).join("");
    $$("#rd i").forEach((d, i) => d.classList.toggle("on", i < picks.length));
    $("#rt").textContent = picks.length < 6 ? `${picks.length + 1}. kart · ${POS[picks.length].ad}` : "Kartlar açılıyor";
  };
  const close = () => { ov.remove(); document.body.style.overflow = ""; };
  const sheet = (on) => { $("#sh").classList.toggle("show", on); if (!on) { pending?.classList.remove("sel"); pending = null; } };
  $("#rx").onclick = close;
  $$("#rg .gcard").forEach(b => b.onclick = () => { if (picks.length >= 6 || b.classList.contains("taken")) return; pending?.classList.remove("sel"); pending = b; b.classList.add("sel"); $("#shp").textContent = `${picks.length + 1}. pozisyon · ${POS[picks.length].ad} — ${POS[picks.length].soru}`; sheet(true); $("#chD").focus(); });
  const place = o => { if (!pending) return; const b = pending; sheet(false); picks.push({ kod: b.dataset.k, o }); b.classList.add("taken"); b.querySelector(".badge").textContent = picks.length; navigator.vibrate?.(12); tray(); if (picks.length === 6) setTimeout(() => { close(); acilis(picks); }, 650); };
  $("#chD").onclick = () => place("D"); $("#chY").onclick = () => place("Y"); $("#chX").onclick = () => sheet(false);
  tray();
}

async function acilis(picks) {
  const p = store.profil(); const P = { ...p, niyet: SECIM.niyet, soru: SECIM.soru.trim() };
  const k = KATMANLAR[store.katman()]; const mod = k.okuma === "tam" && SECIM.derin ? "derin" : k.okuma;
  const A = analyze(D, picks, P);
  const id = Date.now().toString(36);
  const kayit = { id, tarih: new Date().toISOString(), picks, profil: { burc: P.burc, yk: P.yk, niyet: P.niyet, soru: P.soru }, mod, metin: "", baslik: "", durum: "bekliyor" };
  store.addGecmis(kayit);
  // Yorum isteği açılış animasyonu başlamadan gönderilir; bekleme animasyonun arkasında kalır.
  CTL?.abort(); CTL = new AbortController(); const t0 = performance.now(); let tIlk = null;
  const LIVE = window.__LIVE = { id, text: "" };
  const istek = okumaIste({ D, A, profil: P, picks, mod, signal: CTL.signal, onText: text => {
    if (tIlk === null) tIlk = performance.now();
    LIVE.text = text; const out = $("#aiout"); if (out && LIVE.id === id) { out.innerHTML = md(text); $("#oracle")?.classList.add("hidden"); }
  } });
  istek.then(r => {
    const baslik = (r.text.match(/^#\s+(.+)$/m) || [])[1] || "Okuma";
    store.updateGecmis(id, { metin: r.text, baslik, mod: r.mod, durum: "tamam", sure: { ilk: tIlk ? Math.round(tIlk - t0) : null, toplam: Math.round(performance.now() - t0) }, demo: !!r.demo });
    if (location.hash === "#sonuc-" + id) viewSonuc(id);
  }).catch(e => {
    store.updateGecmis(id, { durum: "hata", hata: e instanceof OkumaHatasi ? e.message : "Yorum alınamadı.", hataKod: e.kod });
    if (location.hash === "#sonuc-" + id) viewSonuc(id);
  });

  const ov = document.createElement("div"); ov.className = "reveal";
  ov.innerHTML = `<div class="lab">Kartlar açılıyor</div><div class="rgrid">${picks.map((pk, i) => `<div class="rslot"><div class="box"><div class="c ${pk.o === "Y" ? "y" : ""}"><span class="back"></span>${face(CARD[pk.kod])}</div></div><span class="p">${POS[i].ad}</span></div>`).join("")}</div><p class="small muted" id="rvn"></p>`;
  document.body.appendChild(ov);
  const cs = [...ov.querySelectorAll(".c")];
  for (let i = 0; i < cs.length; i++) { await sleep(i ? 700 : 400); cs[i].classList.add("open"); ov.querySelector("#rvn").textContent = `${POS[i].ad}: ${CARD[picks[i].kod].ad}`; }
  await sleep(1100); ov.remove(); go("sonuc-" + id);
}

/* ---------- Sonuç ---------- */
function viewSonuc(id) {
  chrome(true, "gecmis");
  const r = store.gecmis().find(x => x.id === id);
  if (!r) { $("#view").innerHTML = `<p class="muted">Okuma bulunamadı.</p>`; return; }
  const A = analyze(D, r.picks, r.profil);
  const live = window.__LIVE?.id === id ? window.__LIVE.text : "";
  const metin = r.metin || live;
  const W = CONFIG.MEDIA.waitingVideo;
  $("#view").innerHTML = `
   <section class="stack"><div class="lab">${new Date(r.tarih).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" })} · ${OKUMALAR[r.mod]?.ad || ""}</div>
    <div class="strip">${A.cs.map((c, i) => `<button data-k="${c.kod}" data-i="${i}"><span class="p">${POS[i].ad}</span><span class="bx"><span class="t ${c.o === "Y" ? "y" : ""}">${face(c)}</span></span><span class="n">${esc(c.ad)}</span></button>`).join("")}</div></section>
   <section class="panel">
    <div class="oracle ${metin || r.durum !== "bekliyor" ? "hidden" : ""}" id="oracle">${W ? `<video src="${W}" autoplay muted loop playsinline></video>` : `<div class="orbit"><i></i><i></i><i></i></div>`}<span>Gökler okunuyor…</span></div>
    <div class="aiout" id="aiout">${metin ? md(metin) : ""}</div>
    ${r.durum === "hata" ? `<p class="note" style="border-color:var(--warn)">${esc(r.hata)}</p>` : ""}
    ${r.sure ? `<p class="small muted" style="margin-top:12px">İlk metin ${(r.sure.ilk / 1000 || 0).toFixed(1)} sn · toplam ${(r.sure.toplam / 1000).toFixed(1)} sn${r.demo ? " · demo" : ""}</p>` : ""}
   </section>
   <section class="panel stack"><div class="lab">Okumanın haritası</div>
    <div class="row small">${Object.entries(A.elc).map(([e, n]) => `<span class="chip el-${e}">${e} ${n}</span>`).join("")}<span class="chip">${A.dik} dikey · ${6 - A.dik} yatay</span></div>
    ${A.anaTema.length ? `<div class="row small">${A.anaTema.map(x => `<span class="chip">${TAGS[x.t]} ×${x.n}</span>`).join("")}</div>` : ""}
    ${A.kopru.length ? `<div class="small"><span class="muted">Mitolojik köprüler:</span> ${A.kopru.map(k => `${D.motifler[k.m]} (${k.l.map(c => SET[c.set].mitoloji).filter((v, i, a) => a.indexOf(v) === i).join(" + ")})`).join(" · ")}</div>` : ""}
    <p class="small muted">Kartlara dokunarak anlamlarını ve mitolojik bağlarını inceleyebilirsin.</p></section>
   <a class="btn block" href="#ana">Ana sayfaya dön</a>`;
  $$(".strip button").forEach(b => b.onclick = () => kartDetay(b.dataset.k, A.cs[+b.dataset.i], +b.dataset.i));
}

/* ---------- Kart detayı ---------- */
function kartDetay(kod, okumadaki, i) {
  const c = CARD[kod], s = SET[c.set];
  const o = okumadaki?.o; const pz = okumadaki ? c.poz[POS[i].ad] : null;
  openDialog(`<div class="lab">${s.ad} / ${s.diger} · ${s.mitoloji}</div><h2>${esc(c.ad)}</h2>`, `
   <div class="dcard">${face(c)}<div class="stack"><div class="row small"><span class="chip">${c.gezegen}</span><span class="chip">${c.burc}</span><span class="chip el-${c.element}">${c.element}</span></div>
    ${o ? `<div class="lab">${POS[i].ad} · ${o === "D" ? "Dikey" : "Yatay"}</div><p class="read" style="font-style:italic">${esc(o === "D" ? pz.D : pz.Y)}</p>` : `<p class="small muted">${esc(c.dAnahtar)} · ${esc(c.yAnahtar)}</p>`}</div></div>
   ${o ? `<div><div class="lab">${o === "D" ? "Dikey" : "Yatay"} anlam</div><p class="read">${esc(o === "D" ? c.dAnlam : c.yAnlam)}</p></div>` :
     `<div><div class="lab">Dikey · ${esc(c.dAnahtar)}</div><p class="read">${esc(c.dAnlam)}</p></div><div><div class="lab">Yatay · ${esc(c.yAnahtar)}</div><p class="read">${esc(c.yAnlam)}</p></div>`}
   <div class="mit"><div class="lab">Mitolojik bağ</div><div class="row small">${c.mitFigur.map(f => `<span class="chip">${esc(f)}</span>`).join("")}</div>
    <p class="read">${esc(c.mitDers)}</p><p class="small"><span class="muted">Dikkat:</span> ${esc(c.mitDikkat)}</p></div>
   <div><div class="lab">Mitolojik kaynak</div><p class="read small">${esc(c.mitGercek)}</p></div>
   <div><div class="lab">Kartın hikâyesi</div><p class="read">${esc(c.hikaye)}</p></div>
   ${o ? "" : `<div style="overflow-x:auto"><table class="t"><tr><th>Pozisyon</th><th>Dikey</th><th>Yatay</th></tr>${POS.map(p => `<tr><td>${p.ad}</td><td>${esc(c.poz[p.ad]?.D)}</td><td>${esc(c.poz[p.ad]?.Y)}</td></tr>`).join("")}</table></div>`}`);
}

/* ---------- Kütüphane ---------- */
function viewKartlar() {
  chrome(true, "kartlar");
  $("#view").innerHTML = `<h2>Kartlar</h2>` + D.sets.map(s => `<section class="stack" style="gap:10px">
    <div class="row" style="justify-content:space-between"><h3>${s.ad}</h3><span class="chip">${s.diger} · ${s.mitoloji}</span></div>
    <details><summary class="small" style="color:var(--blue);cursor:pointer">Mitolojik çerçeve</summary><p class="read small" style="margin-top:8px">${esc(s.cerceve)}</p></details>
    <div class="lgrid">${D.cards.filter(c => c.set === s.id).map(c => `<button class="lcard" data-k="${c.kod}">${face(c)}<span class="nm">${esc(c.ad)}</span></button>`).join("")}</div></section>`).join("");
  $$(".lcard").forEach(b => b.onclick = () => kartDetay(b.dataset.k));
}

/* ---------- Geçmiş ---------- */
function viewGecmis() {
  chrome(true, "gecmis"); const g = store.gecmis();
  $("#view").innerHTML = `<h2>Geçmiş</h2>${g.length ? `<div class="hist">${g.map(histItem).join("")}</div>` : `<p class="muted">Henüz okuma yok. İlk okumanı ana sayfadan başlatabilirsin.</p>`}
   <p class="note">Okumaların yalnızca bu cihazda saklanır. Uygulamayı silersen ya da tarayıcı verisini temizlersen kaybolur.</p>`;
}

/* ---------- Profil ---------- */
function viewProfil(alt) {
  chrome(true, "profil");
  if (alt === "duzenle") return viewProfilForm(false);
  const p = store.profil(); const k = store.katman();
  $("#view").innerHTML = `<h2>Profil</h2>
   <section class="panel stack"><div class="row" style="justify-content:space-between"><div class="stack" style="gap:2px"><b>${esc(p.ad || "İsimsiz yolcu")}</b><span class="small muted">${p.burc}${p.yk ? " · yükselen " + p.yk : ""}</span></div><a class="btn" href="#profil-duzenle">Düzenle</a></div></section>
   <section class="panel stack"><div class="lab">Üyelik</div><div class="row" style="justify-content:space-between"><b>${KATMANLAR[k].ad}</b><a class="btn" href="#premium">Planları gör</a></div>
    ${MODE === "sunucu" ? `<label class="f">Test kodu (geliştirme için)<input id="kod" value="${esc(store.kod())}" placeholder="Sunucuda tanımlı kod"></label><button class="btn" id="kodK">Kodu uygula</button>`
      : `<label class="f">Test katmanı (${MODE === "demo" ? "demo" : "önizleme"} modunda)<select id="tk">${Object.entries(KATMANLAR).map(([id, x]) => `<option value="${id}" ${id === k ? "selected" : ""}>${x.ad}</option>`).join("")}</select></label>
         <button class="btn ghost" id="hakSifir">Hak sayacını sıfırla</button>`}</section>
   <section class="panel stack"><div class="lab">Gizlilik</div><button class="btn ghost" id="kv">Aydınlatma metni</button>
    <button class="btn ghost" id="sil">Verilerimi sil</button><div id="silOnay"></div></section>
   <p class="small muted" style="text-align:center">${esc(CONFIG.APP_NAME)} · sürüm ${CONFIG.VERSION} · ${MODE === "sunucu" ? "sunucu modu" : MODE === "demo" ? "demo modu" : "önizleme modu"}</p>`;
  $("#kv").onclick = aydinlatma;
  $("#tk")?.addEventListener("change", e => { store.setKatman(e.target.value); chrome(true, "profil"); toast(`${KATMANLAR[e.target.value].ad} katmanı seçildi`); });
  $("#hakSifir")?.addEventListener("click", () => { store.setHak({}); toast("Hak sayacı sıfırlandı"); });
  $("#kodK")?.addEventListener("click", async () => { store.setKod($("#kod").value.trim()); const h = await hakDurumu(); chrome(true, "profil"); toast(`Katman: ${KATMANLAR[h.katman].ad}`); });
  $("#sil").onclick = () => { $("#silOnay").innerHTML = `<p class="small">Profilin, tüm okuma geçmişin ve ayarların bu cihazdan silinecek. Bu işlem geri alınamaz.</p><div class="row"><button class="btn primary" id="silE">Evet, sil</button><button class="btn ghost" id="silH">Vazgeç</button></div>`;
    $("#silE").onclick = () => { store.hepsiniSil(); go("hosgeldin"); }; $("#silH").onclick = () => $("#silOnay").innerHTML = ""; };
}

/* ---------- Premium ---------- */
const FIYAT = { premium: "79,99 TL / ay", premiumPlus: "149,99 TL / ay" };
function viewPremium() {
  chrome(true, "profil"); const k = store.katman();
  const tier = (id, ozellikler, best) => `<div class="tier ${best ? "best" : ""}"><div class="row" style="justify-content:space-between"><h3>${KATMANLAR[id].ad}</h3>${k === id ? `<span class="chip on">Aktif</span>` : ""}</div>
    <div class="pr">${id === "ucretsiz" ? "Ücretsiz" : FIYAT[id]}</div><ul>${ozellikler.map(o => `<li>${o}</li>`).join("")}</ul>
    ${id !== "ucretsiz" && k !== id ? `<button class="btn ${best ? "primary" : ""} block" ${CONFIG.STORE_READY ? "" : "disabled"}>${CONFIG.STORE_READY ? "Abone ol" : "Satın alma yakında"}</button>` : ""}</div>`;
  $("#view").innerHTML = `<h2>Planlar</h2>
   ${tier("ucretsiz", ["Günde 1, haftada 2 okuma", "Kısa okuma", "Tüm kart kütüphanesi"])}
   ${tier("premium", ["Günde 2, haftada 6 okuma", "Tam okuma: mitolojik köprüler ve kart bağları", "Ayda 2 Derin Okuma", "Reklamsız, okuma geçmişi"], true)}
   ${tier("premiumPlus", ["Günde 2, haftada 6 okuma", "Tüm okumalar Derin Okuma", "Aylık özel okuma (yakında)", "Reklamsız, okuma geçmişi"])}
   <p class="small muted">Fiyatlara KDV dahildir. Abonelik Google Play hesabın üzerinden yönetilir ve istediğin zaman iptal edilebilir.</p>`;
}

/* ---------- Başlat ---------- */
async function init() {
  document.title = CONFIG.APP_NAME;
  $("#brand").innerHTML = `${CONFIG.MEDIA.logo ? `<img src="${CONFIG.MEDIA.logo}" alt="">` : `<span style="width:26px;height:26px;display:inline-block">${EMBLEM}</span>`}<span>${esc(CONFIG.APP_NAME)}</span>`;
  setBack();
  try { D = await (await fetch("data/deste.json")).json(); } catch { $("#view").innerHTML = `<p class="muted">Kart verisi yüklenemedi. İnternet bağlantını kontrol edip uygulamayı yeniden aç.</p>`; return; }
  D.cards.forEach(c => CARD[c.kod] = c); D.sets.forEach(s => SET[s.id] = s);
  MODE = await calismaModu();
  route();
  D.cards.forEach(c => { const i = new Image(); i.src = img(c.kod); });
  if ("serviceWorker" in navigator && location.protocol === "https:" && !window.claude) navigator.serviceWorker.register("sw.js").catch(() => {});
}
init();
