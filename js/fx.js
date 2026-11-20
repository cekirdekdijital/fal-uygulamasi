// Efektler: doğal sesler (rüzgâr, gök gürültüsü, su, fısıltı, kâğıt, kâse), sis ve duman, titreşim, kor parçacıkları.
// Sesler dosya gerektirmez; tarayıcıda üretilir (lisans ve indirme yükü yok).
// Ses ve titreşim kullanıcı tarafından Profil sayfasından kapatılabilir.

const AYAR = "fal.efekt";
const ayar = (() => { try { return { ses: true, titresim: true, ...JSON.parse(localStorage.getItem(AYAR) || "{}") }; } catch { return { ses: true, titresim: true }; } })();
export const efektAyar = () => ({ ...ayar });
export function setEfekt(k, v) { ayar[k] = v; try { localStorage.setItem(AYAR, JSON.stringify(ayar)); } catch {} if (k === "ses" && !v) ortam.durdur(0.3); }
export const azHareket = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const R = (a, b) => a + Math.random() * (b - a);

/* =====================================================================
   SES MOTORU
   Her ses: gürültü kaynağı → filtreler → zarf → (kuru çıkış + mağara yankısı)
   ===================================================================== */
let ctx = null, kuru = null, yanki = null, GUR = {};
function ac() {
  if (!ayar.ses) return null;
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.connect(ctx.destination);
      kuru = ctx.createGain(); kuru.gain.value = 0.9; kuru.connect(comp);
      const conv = ctx.createConvolver(); conv.buffer = yankiIR(3.8); const yg = ctx.createGain(); yg.gain.value = 0.55;
      yanki = ctx.createGain(); yanki.connect(conv); conv.connect(yg); yg.connect(comp);
      GUR = { beyaz: gurultuBuf("beyaz"), pembe: gurultuBuf("pembe"), kahve: gurultuBuf("kahve") };
      document.addEventListener("visibilitychange", () => { if (!ctx) return; document.hidden ? ctx.suspend() : ctx.resume(); });
    }
    if (ctx.state === "suspended" && !document.hidden) ctx.resume();
    return ctx;
  } catch { return null; }
}
// Taş bir mağaranın yankısı: üstel sönen, yavaşça koyulaşan gürültü
function yankiIR(sn) {
  const n = Math.floor(ctx.sampleRate * sn), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let k = 0; k < 2; k++) { const d = b.getChannelData(k); let lp = 0; for (let i = 0; i < n; i++) { const x = i / n; lp += (Math.random() * 2 - 1 - lp) * (0.9 - 0.75 * x); d[i] = lp * Math.pow(1 - x, 3) * (i < 300 ? i / 300 : 1); } }
  return b;
}
function gurultuBuf(tur) {
  const n = ctx.sampleRate * 6, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, son = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (tur === "beyaz") d[i] = w;
    else if (tur === "pembe") { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
    else { son = (son + 0.02 * w) / 1.02; d[i] = son * 3.5; }
  }
  return b;
}
function cikis(node, { pan = 0, rev = 0.4, kuruOran = 1 } = {}) {
  let n = node;
  if (ctx.createStereoPanner && pan) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); n.connect(p); n = p; }
  if (kuruOran) { const g = ctx.createGain(); g.gain.value = kuruOran; n.connect(g); g.connect(kuru); }
  if (rev) { const g = ctx.createGain(); g.gain.value = rev; n.connect(g); g.connect(yanki); }
}
function kaynak(tur, t0, dur, buf) {
  const s = ctx.createBufferSource(); s.buffer = buf || GUR[tur]; if (!buf) s.loop = true;
  s.start(t0, buf ? 0 : R(0, 5)); s.stop(t0 + dur + 0.1); return s;
}
function zarf(g, t0, noktalar) { g.gain.setValueAtTime(0.0001, t0); for (const [t, v] of noktalar) g.gain.linearRampToValueAtTime(Math.max(0.0001, v), t0 + t); }
function filtre(tur, f, q = 0.7) { const x = ctx.createBiquadFilter(); x.type = tur; x.frequency.value = f; x.Q.value = q; return x; }

/** Rüzgâr: pembe gürültü, salınan bant geçiren filtre, hafif uğultu */
function ruzgar({ t = 0, dur = 2.5, vol = 0.2, f = 420, f2 = 900, pan = 0, rev = 0.5 } = {}) {
  const c = ac(); if (!c) return; const t0 = c.currentTime + t;
  const s = kaynak("pembe", t0, dur), bp = filtre("bandpass", f, 1.1), g = c.createGain();
  bp.frequency.setValueAtTime(f, t0); bp.frequency.exponentialRampToValueAtTime(f2, t0 + dur * 0.45); bp.frequency.exponentialRampToValueAtTime(f * 0.8, t0 + dur);
  const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = R(0.25, 0.6); lg.gain.value = f * 0.35; lfo.connect(lg); lg.connect(bp.frequency); lfo.start(t0); lfo.stop(t0 + dur + 0.1);
  const uv = filtre("bandpass", f2 * 1.6, 9), ug = c.createGain(); ug.gain.value = 0.35;
  s.connect(bp); bp.connect(g); s.connect(uv); uv.connect(ug); ug.connect(g);
  zarf(g, t0, [[dur * 0.4, vol], [dur * 0.7, vol * 0.7], [dur, 0]]);
  cikis(g, { pan, rev });
}
/** Uzak gök gürültüsü: kahverengi gürültü, düzensiz gümbürtü */
function gok({ t = 0, vol = 0.45, dur = 4.5, catirti = false, pan = R(-0.4, 0.4) } = {}) {
  const c = ac(); if (!c) return; const t0 = c.currentTime + t;
  const s = kaynak("kahve", t0, dur), lp = filtre("lowpass", 160, 0.6), g = c.createGain();
  lp.frequency.setValueAtTime(320, t0); lp.frequency.exponentialRampToValueAtTime(90, t0 + dur);
  const nk = [[0.12, vol * 0.55]]; let tt = 0.12;
  while (tt < dur - 0.6) { tt += R(0.18, 0.55); nk.push([tt, vol * R(0.25, 1) * (1 - tt / dur)]); }
  nk.push([dur, 0]); zarf(g, t0, nk);
  s.connect(lp); lp.connect(g); cikis(g, { pan, rev: 0.7 });
  if (catirti) { const s2 = kaynak("beyaz", t0, 0.3), hp = filtre("highpass", 1200), g2 = c.createGain(); zarf(g2, t0, [[0.01, vol * 0.35], [0.25, 0]]); s2.connect(hp); hp.connect(g2); cikis(g2, { pan, rev: 0.8 }); }
}
/** Mağarada düşen su damlası */
function damla({ t = 0, f = 900, vol = 0.1, pan = R(-0.5, 0.5) } = {}) {
  const c = ac(); if (!c) return; const t0 = c.currentTime + t;
  const o = c.createOscillator(), g = c.createGain(); o.type = "sine";
  o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * 2.3, t0 + 0.045);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
  o.connect(g); o.start(t0); o.stop(t0 + 0.2); cikis(g, { pan, rev: 0.9, kuruOran: 0.6 });
}
/** Akan su: yumuşak çağıltı ve araya karışan damlalar */
function su({ t = 0, dur = 1.6, vol = 0.07 } = {}) {
  const c = ac(); if (!c) return; const t0 = c.currentTime + t;
  const s = kaynak("beyaz", t0, dur), bp = filtre("bandpass", 1400, 0.9), g = c.createGain();
  const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 7; lg.gain.value = 500; lfo.connect(lg); lg.connect(bp.frequency); lfo.start(t0); lfo.stop(t0 + dur);
  zarf(g, t0, [[dur * 0.3, vol], [dur, 0]]); s.connect(bp); bp.connect(g); cikis(g, { rev: 0.6 });
  for (let i = 0; i < 5; i++) damla({ t: t + R(0.05, dur * 0.8), f: R(700, 1400), vol: vol * 0.9 });
}
/** Fısıltı: nefesli gürültü, ünlü formantları ve hece benzeri genlik dalgası */
function fisilti({ t = 0, dur = 1.3, vol = 0.07, pan = R(-0.7, 0.7) } = {}) {
  const c = ac(); if (!c) return; const t0 = c.currentTime + t;
  const s = kaynak("beyaz", t0, dur), hp = filtre("highpass", 450), top = c.createGain(), g = c.createGain();
  s.connect(hp);
  [[R(450, 800), 7, 1], [R(1100, 1900), 9, 0.8], [R(2300, 3100), 10, 0.55]].forEach(([f, q, a]) => {
    const bp = filtre("bandpass", f, q), ga = c.createGain(); ga.gain.value = a * 3;
    for (let k = 0.15; k < dur; k += R(0.18, 0.32)) bp.frequency.setTargetAtTime(f * R(0.8, 1.25), t0 + k, 0.05);
    hp.connect(bp); bp.connect(ga); ga.connect(top);
  });
  const ss = c.createBiquadFilter(); ss.type = "highpass"; ss.frequency.value = 4500; const sg = c.createGain(); sg.gain.value = 0.25; hp.connect(ss); ss.connect(sg); sg.connect(top);
  const nk = []; let tt = 0.02;
  while (tt < dur - 0.15) { const a = vol * R(0.4, 1); nk.push([tt + 0.06, a], [tt + R(0.12, 0.2), a * 0.6], [tt + R(0.22, 0.3), vol * 0.08]); tt += R(0.24, 0.34); }
  nk.push([dur, 0]); zarf(g, t0, nk); top.connect(g); cikis(g, { pan, rev: 0.65 });
}
/** Kâğıt sürtmesi / hışırtısı. kayma=true: kart kayması (düzgün), false: buruşma (taneli) */
function kagit({ t = 0, dur = 0.25, vol = 0.12, ton = 3200, kayma = true, pan = 0, rev = 0.25 } = {}) {
  const c = ac(); if (!c) return; const t0 = c.currentTime + t;
  const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  let tane = 0, ta = 0;
  for (let i = 0; i < n; i++) {
    const x = i / n, govde = Math.sin(Math.PI * Math.min(1, x * 1.15)) ** (kayma ? 1.5 : 0.6);
    if (!kayma) { if (--tane <= 0) { tane = Math.floor(R(0.002, 0.014) * c.sampleRate); ta = Math.random() < 0.35 ? R(0.6, 1) : R(0.05, 0.3); } }
    d[i] = (Math.random() * 2 - 1) * govde * (kayma ? 0.7 + 0.3 * Math.random() : ta);
  }
  const s = kaynak(null, t0, dur, buf), hp = filtre("highpass", ton * 0.45), bp = filtre("bandpass", ton, 0.6), g = c.createGain();
  if (kayma) { bp.frequency.setValueAtTime(ton * 0.7, t0); bp.frequency.exponentialRampToValueAtTime(ton * 1.5, t0 + dur); }
  g.gain.value = vol; s.connect(hp); hp.connect(bp); bp.connect(g); cikis(g, { pan, rev });
}
/** Tibet kâsesi: uyumsuz kısmi tonlar ve yavaş vuruşlar (tek "müzikal" ses; seyrek kullanılır) */
function kase({ t = 0, f = 196, vol = 0.05, dur = 6, surt = false } = {}) {
  const c = ac(); if (!c) return; const t0 = c.currentTime + t;
  [[1, 1], [2.71, 0.45], [5.15, 0.2], [8.4, 0.08]].forEach(([m, a], k) => {
    [1, 1.0035].forEach(det => {
      const o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = f * m * det;
      const d = dur / (1 + k * 0.7);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol * a, t0 + (surt ? 0.8 : 0.015)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g); o.start(t0); o.stop(t0 + d + 0.1); cikis(g, { rev: 0.5, kuruOran: 0.7 });
    });
  });
}

/* Ortam sesi: okuma sırasında alttan gelen rüzgâr ve uzakta damlalar */
export const ortam = (() => {
  let aktif = null, zam = null;
  return {
    baslat() {
      const c = ac(); if (!c || aktif) return; const t0 = c.currentTime;
      const s = c.createBufferSource(); s.buffer = GUR.pembe; s.loop = true; s.start(t0, R(0, 5));
      const bp = filtre("bandpass", 320, 0.9), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 0.07; lg.gain.value = 140; lfo.connect(lg); lg.connect(bp.frequency); lfo.start(t0);
      const lfo2 = c.createOscillator(), lg2 = c.createGain(); lfo2.frequency.value = 0.11; lg2.gain.value = 0.018; lfo2.connect(lg2); lg2.connect(g.gain);
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.045, t0 + 2.5); lfo2.start(t0);
      s.connect(bp); bp.connect(g); cikis(g, { rev: 0.4 });
      aktif = { s, g, lfo, lfo2 };
      const olay = () => { zam = setTimeout(() => { if (!aktif) return; Math.random() < 0.6 ? damla({ f: R(600, 1200), vol: 0.035 }) : fisilti({ dur: R(0.8, 1.4), vol: 0.022 }); olay(); }, R(5000, 11000)); };
      olay();
    },
    durdur(sn = 1.8) {
      clearTimeout(zam); if (!aktif || !ctx) return aktif = null; const { s, g, lfo, lfo2 } = aktif, t0 = ctx.currentTime; aktif = null;
      g.gain.cancelScheduledValues(t0); lfo2.disconnect(); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t0); g.gain.linearRampToValueAtTime(0.0001, t0 + sn);
      [s, lfo, lfo2].forEach(x => { try { x.stop(t0 + sn + 0.1); } catch {} });
    },
  };
})();

// Uygulamanın kullandığı ses olayları
export const ses = {
  dokun() { kagit({ dur: 0.045, vol: 0.05, ton: 4200, kayma: false, rev: 0.1 }); },
  gecis() { ruzgar({ dur: 1.1, vol: 0.05, f: 520, f2: 1100, pan: R(-0.5, 0.5), rev: 0.35 }); },
  acilis() { ruzgar({ dur: 3.6, vol: 0.16, f: 300, f2: 760 }); gok({ t: 0.6, vol: 0.22, dur: 4 }); fisilti({ t: 1.2, dur: 1.4, vol: 0.04 }); },
  kaldir() { kagit({ dur: 0.22, vol: 0.09, ton: 2600 }); ruzgar({ dur: 0.7, vol: 0.035, f: 700, f2: 1300, rev: 0.3 }); },
  yerlestir(i = 0) { kagit({ dur: 0.18, vol: 0.1, ton: 2200 }); damla({ t: 0.12, f: 640 + i * 70, vol: 0.09 }); },
  karistir() {
    ruzgar({ dur: 2.2, vol: 0.07, f: 380, f2: 820 });
    for (let k = 0; k < 2; k++) { kagit({ t: 0.25 + k * 0.78, dur: 0.55, vol: 0.13, kayma: false, ton: 3400, pan: k ? 0.3 : -0.3 }); kagit({ t: 0.7 + k * 0.78, dur: 0.12, vol: 0.08, ton: 2000 }); }
  },
  dagit(i) { if (i % 2) return; kagit({ dur: 0.07, vol: 0.045, ton: R(2800, 4200), pan: R(-0.6, 0.6), rev: 0.15 }); },
  cevir(i = 0) { kagit({ dur: 0.2, vol: 0.09, ton: 3000, pan: (i % 3 - 1) * 0.5 }); fisilti({ t: 0.15, dur: R(0.9, 1.3), vol: 0.055, pan: (i % 3 - 1) * 0.6 }); },
  koruyucu() { gok({ vol: 0.4, dur: 5, catirti: false }); ruzgar({ t: 0.2, dur: 3.8, vol: 0.14, f: 260, f2: 640 }); kase({ t: 0.5, f: 110, vol: 0.05, dur: 8, surt: true }); fisilti({ t: 1.6, dur: 1.6, vol: 0.04 }); },
  tamam() { kase({ f: 196, vol: 0.035, dur: 5 }); ruzgar({ dur: 1.6, vol: 0.04, f: 500, f2: 900 }); },
  su() { su(); },
};

/* ---------- Titreşim ---------- */
export const titres = d => { if (ayar.titresim && navigator.vibrate) try { navigator.vibrate(d); } catch {} };

/* =====================================================================
   GÖRSEL: yıldızlar, arka sis (içeriğin arkasında), ön sis ve duman (içeriğin önünde), korlar
   ===================================================================== */
let sky = null, front = null;
const puflar = [], parts = []; let perde = { a: 0, hiz: 0 }, onSis = 0;
// Sis dokusu: üst üste binen yumuşak lekeler, kenarları silik
function sisDokusu(tohum) {
  const S = 256, c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d");
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * 6.28, r = Math.random() ** 0.7 * S * 0.3, cx = S / 2 + Math.cos(a) * r, cy = S / 2 + Math.sin(a) * r * 0.75, rr = R(S * 0.08, S * 0.24);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr); const al = R(0.05, 0.16) * (1 - r / (S * 0.36));
    g.addColorStop(0, `rgba(${tohum},${al})`); g.addColorStop(1, `rgba(${tohum},0)`); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rr, 0, 6.28); x.fill();
  }
  return c;
}
let DOKU = [];
export function gokyuzu() {
  if (sky) return;
  sky = document.createElement("canvas"); sky.id = "sky"; sky.setAttribute("aria-hidden", "true");
  front = document.createElement("canvas"); front.id = "sparks"; front.setAttribute("aria-hidden", "true");
  document.body.prepend(sky); document.body.appendChild(front);
  DOKU = ["168,178,216", "140,152,204", "184,172,208"].map(sisDokusu);
  const sx = sky.getContext("2d"), px = front.getContext("2d");
  let W, H, dpr; const stars = [], dust = [], arkaSis = [];
  const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; for (const c of [sky, front]) { c.width = W * dpr; c.height = H * dpr; } sx.setTransform(dpr, 0, 0, dpr, 0, 0); px.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener("resize", size);
  for (let i = 0; i < 80; i++) stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.1 + 0.3, p: Math.random() * 6.28, s: 0.3 + Math.random() * 0.9 });
  for (let i = 0; i < 18; i++) dust.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + 0.5, vx: (Math.random() - 0.5) * 0.003, vy: -0.0015 - Math.random() * 0.004, a: Math.random() * 0.3 + 0.08 });
  // Yerde süzülen sis bantları
  for (let i = 0; i < 9; i++) arkaSis.push({ x: Math.random(), y: R(0.55, 1.05), s: R(0.7, 1.3), vx: R(0.004, 0.012) * (Math.random() < 0.5 ? -1 : 1), a: R(0.1, 0.22), d: DOKU[i % 3], rot: R(0, 6.28) });
  let last = 0; const still = azHareket();
  const ciz = (x, p, W, H) => {
    const k = Math.min(W, H) * p.r; x.save(); x.globalAlpha = p.al; x.translate(p.x, p.y); x.rotate(p.rot); x.drawImage(p.d, -k, -k * 0.8, k * 2, k * 1.6); x.restore();
  };
  const loop = t => {
    requestAnimationFrame(loop);
    if (document.hidden || t - last < 33) return; const dt = Math.min(0.1, (t - last) / 1000); last = t;
    // Arka katman
    sx.clearRect(0, 0, W, H);
    for (const s of stars) { const a = still ? 0.5 : 0.28 + 0.3 * Math.sin(t / 1000 * s.s + s.p); sx.fillStyle = `rgba(235,232,243,${a})`; sx.beginPath(); sx.arc(s.x * W, s.y * H, s.r, 0, 6.28); sx.fill(); }
    if (!still) {
      for (const d of dust) { d.x += d.vx * dt * 6; d.y += d.vy * dt * 6; if (d.y < -0.02) { d.y = 1.02; d.x = Math.random(); } if (d.x < 0) d.x = 1; if (d.x > 1) d.x = 0; sx.fillStyle = `rgba(132,150,224,${d.a})`; sx.beginPath(); sx.arc(d.x * W, d.y * H, d.r, 0, 6.28); sx.fill(); }
      for (const f of arkaSis) { f.x += f.vx * dt; if (f.x > 1.4) f.x = -0.4; if (f.x < -0.4) f.x = 1.4; f.rot += 0.01 * dt; ciz(sx, { x: f.x * W, y: f.y * H, r: f.s * 0.6, rot: f.rot, al: f.a * (0.75 + 0.25 * Math.sin(t / 4000 + f.rot)), d: f.d }, W, H); }
    }
    // Ön katman: perde (yoğun sis), puflar, korlar
    px.clearRect(0, 0, W, H);
    if (perde.a > 0.002) { px.fillStyle = `rgba(20,24,46,${perde.a})`; px.fillRect(0, 0, W, H); perde.a = Math.max(0, perde.a - perde.hiz * dt); }
    if (onSis > 0 && !still && Math.random() < dt * 1.6 * onSis) puflar.push({ x: R(-0.1, 1.1) * W, y: H * R(0.75, 1.05), vx: R(-14, 14), vy: R(-16, -6), r: R(0.35, 0.6), g: 0.04, rot: R(0, 6.28), vr: R(-0.1, 0.1), life: R(5, 8), max: 0, tepe: 0.16 * onSis, d: DOKU[(Math.random() * 3) | 0] });
    for (let i = puflar.length - 1; i >= 0; i--) {
      const p = puflar[i]; if (!p.max) p.max = p.life; p.life -= dt; if (p.life <= 0) { puflar.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.g * dt; p.rot += p.vr * dt; p.vx *= 0.995; p.vy *= 0.995;
      const x = 1 - p.life / p.max; p.al = p.tepe * Math.min(1, x / 0.22) * Math.min(1, (1 - x) / 0.55); ciz(px, p, W, H);
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vx *= 0.97; p.vy = p.vy * 0.97 - 14 * dt; p.x += (p.vx + Math.sin(p.life * 5 + p.f) * 10) * dt; p.y += p.vy * dt;
      const a = Math.max(0, p.life / p.max) * (0.7 + 0.3 * Math.sin(p.life * 22 + p.f)); px.fillStyle = p.renk.replace("A", a.toFixed(3));
      px.beginPath(); px.arc(p.x, p.y, p.r * (0.4 + a * 0.6), 0, 6.28); px.fill();
    }
  };
  requestAnimationFrame(loop);
}

/* Sis ve duman API'si */
const ek = (o) => { if (!azHareket() && front) puflar.push(o); };
export const sis = {
  /** Açılış: ekranı kaplayan yoğun sis yavaşça dağılır */
  acilis(sure = 2.8, yog = 1) {
    if (azHareket() || !front) return; const W = innerWidth, H = innerHeight;
    perde = { a: 0.92 * yog, hiz: 0.92 * yog / (sure * 0.55) };
    for (let i = 0; i < 16; i++) { const x = R(0, 1) * W, y = R(0, 1) * H, dx = x - W / 2, dy = y - H / 2, L = Math.hypot(dx, dy) || 1;
      ek({ x, y, vx: dx / L * R(30, 70), vy: dy / L * R(20, 50) - 10, r: R(0.5, 0.85), g: 0.12, rot: R(0, 6.28), vr: R(-0.15, 0.15), life: sure * R(0.8, 1.15), tepe: R(0.45, 0.7) * yog, d: DOKU[i % 3] }); }
  },
  /** Sayfa geçişi: alttan ve kenarlardan ince bir sis tülü geçer */
  gecis() {
    if (azHareket() || !front) return; const W = innerWidth, H = innerHeight;
    for (let i = 0; i < 6; i++) { const sol = i % 2 ? -1 : 1;
      ek({ x: W / 2 - sol * W * R(0.35, 0.6), y: H * R(0.25, 0.95), vx: sol * R(40, 90), vy: R(-14, -4), r: R(0.45, 0.7), g: 0.08, rot: R(0, 6.28), vr: R(-0.12, 0.12), life: R(1.3, 1.9), tepe: R(0.18, 0.3), d: DOKU[i % 3] }); }
  },
  /** Bir öğeden yükselen duman (kart yerleşince, kart açılınca) */
  duman(el, { n = 4, renk = 0, tepe = 0.4 } = {}) {
    if (azHareket() || !front || !el) return; const b = el.getBoundingClientRect(), k = Math.min(innerWidth, innerHeight);
    for (let i = 0; i < n; i++) ek({ x: b.left + b.width * R(0.2, 0.8), y: b.top + b.height * R(0.4, 0.9), vx: R(-12, 12), vy: R(-40, -18), r: Math.max(0.06, b.width / k * R(0.45, 0.7)), g: 0.05, rot: R(0, 6.28), vr: R(-0.4, 0.4), life: R(1.2, 2), tepe, d: DOKU[renk % 3] });
  },
  /** Okuma ekranlarında kenarlardan süzülen sürekli hafif sis (0 = kapalı, 1 = tam) */
  surekli(v) { onSis = v; },
};

const RGBA = { kirmizi: "rgba(214,90,79,A)", mavi: "rgba(132,150,224,A)", altin: "rgba(240,200,120,A)", beyaz: "rgba(255,250,240,A)" };
/** Kor parçacıkları: yukarı süzülen, titreşen ışıklar. renk: kirmizi|mavi|altin|beyaz ya da "rgba(r,g,b,A)" */
export function kivilcim(x, y, { n = 14, renk = "altin", hiz = 70, omur = 1.6 } = {}) {
  if (azHareket() || !front) return;
  const r = RGBA[renk] || renk;
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = hiz * (0.2 + Math.random()); parts.push({ x: x + R(-14, 14), y: y + R(-10, 10), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - 20, r: 0.8 + Math.random() * 1.8, life: omur * (0.6 + Math.random() * 0.6), max: omur * 1.2, renk: r, f: R(0, 6.28) }); }
}
export function kivilcimEl(el, opt) { const b = el.getBoundingClientRect(); kivilcim(b.left + b.width / 2, b.top + b.height / 2, opt); }
