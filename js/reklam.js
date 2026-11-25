// Ödüllü reklam (AdMob) — yalnızca Android uygulamasında ve Ücretsiz planda.
// Kişiselleştirilmemiş reklam istenir (npa). Ödül sunucuya AdMob'un imzalı bildirimiyle (SSV) gelir;
// uygulama yalnızca reklamı gösterir ve sunucudaki krediyi bekler.
import { CONFIG } from "../app.config.js";
import { store } from "./store.js";
import * as H from "./hesap.js";

const yerelMi = () => !!window.Capacitor?.isNativePlatform?.();
const AM = () => { const C = window.Capacitor; if (!yerelMi()) return null; return C.Plugins?.AdMob || C.registerPlugin?.("AdMob") || null; };
export const reklamVar = () => !!CONFIG.ADMOB?.odulluId && !!AM();
let hazir = null;
const baslat = () => hazir ||= AM().initialize({}).catch(() => {});

async function numaraAl() {
  const belge = await H.kimlikBelgesi();
  const r = await fetch(`${CONFIG.API_URL}/api/reklam/baslat`, { method: "POST", headers: { "content-type": "application/json", ...(belge ? { authorization: "Bearer " + belge } : {}) }, body: JSON.stringify({ cihaz: store.cihaz() }) });
  if (!r.ok) throw new Error("numara"); return (await r.json()).numara;
}
// Sunucuda reklam kredisi görünene kadar bekler (AdMob bildirimi birkaç saniye gecikebilir)
async function krediBekle(hakSorgu, sure = 12000) {
  const son = Date.now() + sure;
  while (Date.now() < son) { const h = await hakSorgu(); if ((h?.reklamKredi || 0) > 0) return true; await new Promise(r => setTimeout(r, 1500)); }
  return false;
}

/**
 * Ödüllü reklamı gösterir.
 * Döner: "odul" (izlendi, kredi sunucuda) | "yok" (reklam yüklenemedi / reklam altyapısı yok) | "iptal" (kullanıcı ödülden önce kapattı)
 */
export async function odulluReklam(hakSorgu) {
  if (!reklamVar()) return "yok";
  const A = AM(); await baslat();
  let numara; try { numara = await numaraAl(); } catch { return "yok"; }
  try { await A.prepareRewardVideoAd({ adId: CONFIG.ADMOB.odulluId, npa: true, isTesting: !!CONFIG.ADMOB.test, ssv: { customData: numara } }); }
  catch { return "yok"; }
  let odul = null;
  try { odul = await A.showRewardVideoAd(); } catch { return "iptal"; }
  if (!odul || (odul.amount === undefined && !odul.type)) return "iptal";
  return (await krediBekle(hakSorgu)) ? "odul" : "yok";
}
