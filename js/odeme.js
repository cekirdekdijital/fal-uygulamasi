// Google Play abonelikleri (yalnızca Android uygulamasında).
// Satın alma @capgo/native-purchases eklentisiyle yapılır; satın alma belgesi sunucuda Google'a doğrulatılır,
// plan kullanıcının hesabına tanımlanır ve satın alma sunucu tarafından onaylanır (acknowledge).
// Web sürümünde satın alma yoktur; Planlar sayfası "Android uygulamasından abone olabilirsin" der.
import { CONFIG } from "../app.config.js";
import { PLAY_URUN, PLAY_PLAN, playUrunu } from "../shared/katmanlar.js";
import * as H from "./hesap.js";

const yerelMi = () => !!window.Capacitor?.isNativePlatform?.();
const NP = () => { const C = window.Capacitor; if (!yerelMi()) return null; return C.Plugins?.NativePurchases || C.registerPlugin?.("NativePurchases") || null; };
export const odemeVar = () => !!CONFIG.STORE_READY && yerelMi() && !!NP();

// Sunucudaki karma ile aynı: sha256("logos:" + uid), onaltılık
async function hesapKarmasi(uid) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("logos:" + uid));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 64);
}

// Play'deki güncel fiyatlar (yerel para birimi, Google'ın gösterdiği biçim): { gumus: "124,99 TL", ... }
let fiyatOnbellek = null;
export async function playFiyatlari() {
  if (!odemeVar()) return {};
  if (fiyatOnbellek) return fiyatOnbellek;
  try {
    const { products } = await NP().getProducts({ productIdentifiers: Object.keys(PLAY_URUN), productType: "subs" });
    const f = {};
    for (const p of products || []) { const urun = PLAY_URUN[p.planIdentifier] ? p.planIdentifier : p.identifier; if (PLAY_URUN[urun] && p.priceString) f[PLAY_URUN[urun]] = p.priceString; }
    return (fiyatOnbellek = f);
  } catch { return {}; }
}

async function sunucuyaDogrulat(token) {
  const belge = await H.kimlikBelgesi(); if (!belge) throw { kod: "giris_gerek" };
  const r = await fetch(`${CONFIG.API_URL}/api/abonelik/dogrula`, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + belge }, body: JSON.stringify({ token }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw { kod: j.kod || "sunucu", mesaj: j.mesaj };
  return j;
}

// Satın al: katman "gumus" | "altin" | "elmas". Başarılıysa sunucunun döndürdüğü { katman, bitis }.
export async function satinAl(katman) {
  if (!odemeVar()) throw { kod: "odeme_yok" };
  const u = H.kullanici(); if (!u) throw { kod: "giris_gerek" };
  const urun = playUrunu(katman); if (!urun) throw { kod: "urun_yok" };
  const tx = await NP().purchaseProduct({ productIdentifier: urun, planIdentifier: PLAY_PLAN, productType: "subs", quantity: 1,
    appAccountToken: await hesapKarmasi(u.uid), autoAcknowledgePurchases: false });
  const token = tx?.purchaseToken || tx?.transactionId; if (!token) throw { kod: "iptal" };
  return sunucuyaDogrulat(token);
}

// Geri yükle: bu Google hesabındaki etkin Logos aboneliklerini oturum açılan Logos hesabına tanımlar
export async function geriYukle() {
  if (!odemeVar() || !H.kullanici()) return null;
  try {
    const { purchases } = await NP().getPurchases({ productType: "subs" });
    let son = null;
    for (const p of purchases || []) { const t = p.purchaseToken || p.transactionId; if (t && PLAY_URUN[p.productIdentifier]) { try { son = await sunucuyaDogrulat(t); } catch {} } }
    return son;
  } catch { return null; }
}

export const aboneligiYonet = () => NP()?.manageSubscriptions?.();
