// Hesap sistemi (Firebase Authentication · Google ile giriş + e-posta/şifre).
// Android uygulamasında Google girişi yerel pencereyle yapılır (@capacitor-firebase/authentication eklentisi, skipNativeAuth);
// eklentinin verdiği Google kimlik belgesiyle web SDK'sında oturum açılır. Web'de açılır pencere (popup) kullanılır.
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
// Android uygulamasında yerel eklenti; Capacitor.Plugins boşsa registerPlugin ile alınır
const yerelMi = () => !!window.Capacitor?.isNativePlatform?.();
const YEREL = () => { const C = window.Capacitor; if (!yerelMi()) return null; return C.Plugins?.FirebaseAuthentication || C.registerPlugin?.("FirebaseAuthentication") || null; };
export const googleVar = () => hesapAcik();
async function googleKimligi(a) {
  const FA = YEREL();
  if (yerelMi() && !FA) throw { code: "eklenti-yok", message: "FirebaseAuthentication eklentisi bulunamadı" };
  if (FA) { const r = await FA.signInWithGoogle(); const tok = r?.credential?.idToken; if (!tok) throw { code: "auth/popup-closed-by-user" }; return F.GoogleAuthProvider.credential(tok); }
  return null;
}
export async function googleIleGiris(dil) {
  const a = await hazirla(dil);
  await F.setPersistence(a, F.browserLocalPersistence);
  const kimlik = await googleKimligi(a);
  if (kimlik) return (await F.signInWithCredential(a, kimlik)).user;
  const p = new F.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
  try { return (await F.signInWithPopup(a, p)).user; }
  catch (e) { if (String(e?.code).includes("popup-blocked")) { await F.signInWithRedirect(a, p); return null; } throw e; }
}
// Hassas işlemlerden (hesap silme) önce yeniden doğrulama
export async function yenidenDogrula(sifre) {
  const a = await yukle(); const u = a?.currentUser; if (!u) return;
  if (u.providerData.some(x => x.providerId === "google.com")) {
    const kimlik = await googleKimligi(a);
    if (kimlik) return F.reauthenticateWithCredential(u, kimlik);
    return F.reauthenticateWithPopup(u, new F.GoogleAuthProvider());
  }
  if (sifre) return F.reauthenticateWithCredential(u, F.EmailAuthProvider.credential(u.email, sifre));
  throw { code: "auth/requires-recent-login" };
}
export const googleHesabi = () => !!aktifKullanici?.providerData?.some(x => x.providerId === "google.com");
export async function cikisYap() { const a = await yukle(); try { await YEREL()?.signOut(); } catch {} if (a) await F.signOut(a); }
export async function hesabiSil() { const a = await yukle(); if (a?.currentUser) await F.deleteUser(a.currentUser); }

// Firebase hata kodunu dil dosyasındaki anahtara çevirir
// Bilinmeyen hatalarda kısa teknik kod (destek ve hata ayıklama için); son hata cihazda saklanır
export function hataKodu(e) {
  const k = String(e?.code || e?.errorMessage || e?.message || e || "").replace(/^auth\//, "").slice(0, 80);
  try { localStorage.setItem("logos.sonHata", JSON.stringify({ t: new Date().toISOString(), k, m: String(e?.message || "").slice(0, 300) })); } catch {}
  return k;
}
export function hataAnahtari(e) {
  if (/cancel/i.test(String(e?.message || "")) && !e?.code) return "hs.hata.iptal";
  const c = String(e?.code || "").replace("auth/", "");
  const E = { "invalid-credential": "kimlik", "wrong-password": "kimlik", "user-not-found": "kimlik", "invalid-login-credentials": "kimlik",
    "email-already-in-use": "kayitli", "weak-password": "zayif", "password-does-not-meet-requirements": "zayif", "invalid-email": "eposta",
    "too-many-requests": "cokDeneme", "popup-closed-by-user": "iptal", "cancelled-popup-request": "iptal", "account-exists-with-different-credential": "baskaYontem", "network-request-failed": "ag", "requires-recent-login": "yenidenGiris", "kapali": "kapali" };
  return "hs.hata." + (E[c] || "genel");
}
