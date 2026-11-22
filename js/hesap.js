// Hesap sistemi (Firebase Authentication · e-posta + şifre).
// app.config.js içindeki FIREBASE ayarları boşsa hesap sistemi kapalıdır ve uygulama hesapsız (cihaz bazlı) çalışır.
// Firebase kitaplığı yalnızca ayar doluysa, Google'ın sunucusundan (gstatic) yüklenir.
import { CONFIG } from "../app.config.js";

const SURUM = "12.19.0";
const URL_ = m => `https://www.gstatic.com/firebasejs/${SURUM}/firebase-${m}.js`;
let F = null, auth = null, hazirP = null, aktifKullanici = null;
const dinleyiciler = new Set();

export const hesapAcik = () => !!CONFIG.FIREBASE?.apiKey;

function yukle() {
  if (!hesapAcik()) return Promise.resolve(null);
  if (!hazirP) hazirP = (async () => {
    const [app, a] = await Promise.all([import(URL_("app")), import(URL_("auth"))]);
    F = a; auth = a.getAuth(app.initializeApp(CONFIG.FIREBASE));
    await new Promise(r => { let ilk = true; a.onAuthStateChanged(auth, u => { aktifKullanici = u; dinleyiciler.forEach(f => f(u)); if (ilk) { ilk = false; r(); } }); });
    return auth;
  })().catch(e => { console.warn("Firebase yüklenemedi", e); hazirP = null; return null; });
  return hazirP;
}
export const hesapHazir = yukle;

export const kullanici = () => aktifKullanici;
export function hesapDinle(f) { dinleyiciler.add(f); return () => dinleyiciler.delete(f); }

// Sunucuya gönderilecek kimlik belgesi (1 saatlik, Firebase kendisi yeniler)
export async function kimlikBelgesi() {
  if (!hesapAcik()) return null; await yukle();
  try { return aktifKullanici ? await aktifKullanici.getIdToken() : null; } catch { return null; }
}

async function hazirla(dil, hatirla) {
  const a = await yukle(); if (!a) throw { code: "kapali" };
  a.languageCode = dil;
  if (hatirla !== undefined) await F.setPersistence(a, hatirla ? F.browserLocalPersistence : F.browserSessionPersistence);
  return a;
}
export async function kayitOl(eposta, sifre, { dil, hatirla }) {
  const a = await hazirla(dil, hatirla);
  const r = await F.createUserWithEmailAndPassword(a, eposta, sifre);
  try { await F.sendEmailVerification(r.user); } catch {}
  return r.user;
}
export async function girisYap(eposta, sifre, { dil, hatirla }) {
  const a = await hazirla(dil, hatirla);
  return (await F.signInWithEmailAndPassword(a, eposta, sifre)).user;
}
export async function sifreSifirla(eposta, dil) { const a = await hazirla(dil); await F.sendPasswordResetEmail(a, eposta); }
export async function dogrulamaGonder(dil) { const a = await hazirla(dil); if (a.currentUser) await F.sendEmailVerification(a.currentUser); }
export async function dogrulamaYenile() { if (aktifKullanici) { await aktifKullanici.reload(); await aktifKullanici.getIdToken(true); } return aktifKullanici; }
export async function cikisYap() { const a = await yukle(); if (a) await F.signOut(a); }
export async function hesabiSil() { const a = await yukle(); if (a?.currentUser) await F.deleteUser(a.currentUser); }

// Firebase hata kodunu dil dosyasındaki anahtara çevirir
export function hataAnahtari(e) {
  const c = String(e?.code || "").replace("auth/", "");
  const E = { "invalid-credential": "kimlik", "wrong-password": "kimlik", "user-not-found": "kimlik", "invalid-login-credentials": "kimlik",
    "email-already-in-use": "kayitli", "weak-password": "zayif", "password-does-not-meet-requirements": "zayif", "invalid-email": "eposta",
    "too-many-requests": "cokDeneme", "network-request-failed": "ag", "requires-recent-login": "yenidenGiris", "kapali": "kapali" };
  return "hs.hata." + (E[c] || "genel");
}
