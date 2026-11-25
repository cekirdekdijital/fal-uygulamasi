// Sunucu katmanı (Cloudflare Worker)
// - Claude API anahtarını gizli tutar (anahtar uygulamaya hiç gönderilmez)
// - Talimatı (prompt) sunucuda kurar; kullanıcı talimatı değiştiremez
// - Günlük, haftalık ve aylık hakları denetler
// - Hesaplı kullanıcıların Firebase kimlik belgesini doğrular; hakları hesaba (uid) bağlar
// Uç noktalar:  GET /api/hak   POST /api/okuma
import D from "../../data/deste.json";
import { KATMANLAR, OKUMALAR, UCRETLI, katmanId } from "../../shared/katmanlar.js";
import { analyze, validatePicks, SIGN } from "../../shared/motor.js";
import { buildPrompt } from "../../shared/prompt.js";
import { DILLER, yerelIstem } from "../../shared/diller.js";
// Dil paketleri: yeni dil hazır olduğunda iki satır ekleyin (metin + kart çevirisi) ve DIL_PAKETI'ne yazın.
import EN from "../../i18n/en.json";
import KART_EN from "../../data/kartlar/en.json";
import AR from "../../i18n/ar.json";
import KART_AR from "../../data/kartlar/ar.json";
import DE from "../../i18n/de.json";
import KART_DE from "../../data/kartlar/de.json";
import RU from "../../i18n/ru.json";
import KART_RU from "../../data/kartlar/ru.json";
const DIL_PAKETI = { en: [EN, KART_EN], ar: [AR, KART_AR], de: [DE, KART_DE], ru: [RU, KART_RU] };

const json = (obj, status, cors) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", ...cors } });

function corsHeaders(req, env) {
  const origin = req.headers.get("origin") || "";
  const izinli = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const ok = izinli.includes("*") || izinli.includes(origin);
  return ok ? { "access-control-allow-origin": origin || "*", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS", "access-control-allow-headers": "content-type,authorization,x-logos-kod", "access-control-expose-headers": "x-mod,x-gun-kalan,x-hafta-kalan", vary: "origin" } : {};
}

// İstanbul saatine göre gün / ISO hafta / ay anahtarı
function zaman(d = new Date()) {
  const t = new Date(d.getTime() + 3 * 3600e3);
  const gun = t.toISOString().slice(0, 10), ay = gun.slice(0, 7);
  const th = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
  th.setUTCDate(th.getUTCDate() - ((th.getUTCDay() + 6) % 7) + 3);
  const y1 = new Date(Date.UTC(th.getUTCFullYear(), 0, 4));
  const w = 1 + Math.round(((th - y1) / 864e5 - 3 + ((y1.getUTCDay() + 6) % 7)) / 7);
  return { gun, hafta: `${th.getUTCFullYear()}-H${String(w).padStart(2, "0")}`, ay };
}

/* ---------- Firebase kimlik doğrulama ----------
   Uygulama, giriş yapmış kullanıcı için "authorization: Bearer <kimlik belgesi>" gönderir.
   Belge Google'ın açık anahtarlarıyla (RS256) doğrulanır. Gerekli ayar: FIREBASE_PROJECT_ID (wrangler.toml [vars]). */
const JWK_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let JWK = { t: 0, keys: [] };
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), c => c.charCodeAt(0));
async function anahtarlar(yenile) {
  if (!yenile && JWK.keys.length && Date.now() - JWK.t < 3600e3) return JWK.keys;
  const r = await fetch(JWK_URL); if (!r.ok) return JWK.keys;
  JWK = { t: Date.now(), keys: (await r.json()).keys || [] }; return JWK.keys;
}
async function kimlikDogrula(req, env) {
  const h = req.headers.get("authorization") || ""; if (!h.startsWith("Bearer ") || !env.FIREBASE_PROJECT_ID) return null;
  const [h64, p64, s64] = h.slice(7).trim().split("."); if (!s64) return null;
  try {
    const bas = JSON.parse(new TextDecoder().decode(b64u(h64))), y = JSON.parse(new TextDecoder().decode(b64u(p64)));
    if (bas.alg !== "RS256") return null;
    let jwk = (await anahtarlar()).find(k => k.kid === bas.kid) || (await anahtarlar(true)).find(k => k.kid === bas.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(s64), new TextEncoder().encode(`${h64}.${p64}`));
    const now = Math.floor(Date.now() / 1000), pid = env.FIREBASE_PROJECT_ID;
    if (!ok || y.aud !== pid || y.iss !== `https://securetoken.google.com/${pid}` || !y.sub || y.exp < now - 60 || y.iat > now + 300) return null;
    return { uid: y.sub, eposta: y.email || "", dogrulandi: !!y.email_verified };
  } catch { return null; }
}

/* ---------- Plan ----------
   Kodlar büyük/küçük harf ve boşluk duyarsızdır (telefon klavyesi ilk harfi büyütse de çalışır).
   1) Tam erişim kodu: TAM_ERISIM_KODU gizli değeri. Elmas + sınırsıza yakın kullanım (güvenlik için günde TAM_GUNLUK okuma).
   2) Hesaba bağlı abonelik: KV "abone:<uid>" = {"katman":"altin","bitis":"2026-12-31T00:00:00Z"}
   3) Hediye koduyla cihaza tanımlı plan: KV "abone_c:<cihaz>" (aynı biçim)
   4) Test kodları: PREMIUM_KODLARI = "kod1:gumus,kod2:altin,kod3:elmas"
   5) Hediye kodu ilk kez girildiğinde: KV "hediye:<KOD>" = {katman, gun, adet, kullanan:[...]} → 2. veya 3. kayıt yazılır. */
const kodNorm = s => String(s || "").trim().replace(/\s+/g, "").toUpperCase();
// Google Play inceleme kodu (INCELEME_KODU): incelemeciler Türkiye dışından bağlanabilir; bu kod ülke sınırını açar ve Elmas verir.
const incelemeMi = (env, k) => !!(k && env.INCELEME_KODU && kodNorm(k) === kodNorm(env.INCELEME_KODU));
const aktifAbone = a => a && KATMANLAR[katmanId(a.katman)] && (!a.bitis || new Date(a.bitis) > new Date());
async function katmanBul(env, kod, kim, cihaz) {
  const k = kodNorm(kod);
  if (k && env.TAM_ERISIM_KODU && k === kodNorm(env.TAM_ERISIM_KODU)) return { katman: "elmas", sinirsiz: true };
  if (incelemeMi(env, k)) return { katman: "elmas", sinirsiz: true, sayac: "inc" };
  const aboneKey = kim ? `abone:${kim.uid}` : cihaz ? `abone_c:${cihaz}` : null;
  if (aboneKey) { const a = await env.HAK.get(aboneKey, "json"); if (aktifAbone(a)) return { katman: katmanId(a.katman), bitis: a.bitis || null }; }
  // Hesapsızken cihaza tanımlanan plan (hediye kodu), kullanıcı giriş yapınca hesaba taşınır
  if (kim && cihaz) { const c = await env.HAK.get(`abone_c:${cihaz}`, "json");
    if (aktifAbone(c)) { const ttl = Math.max(120, Math.ceil((new Date(c.bitis || Date.now() + 864e5) - Date.now()) / 1000) + 86400);
      await env.HAK.put(aboneKey, JSON.stringify({ ...c, tasindi: new Date().toISOString() }), { expirationTtl: ttl }); await env.HAK.delete(`abone_c:${cihaz}`);
      return { katman: katmanId(c.katman), bitis: c.bitis || null }; } }
  if (k) for (const p of (env.PREMIUM_KODLARI || "").split(",")) { const [x, t] = p.split(":").map(s => s?.trim()); if (x && kodNorm(x) === k) return { katman: katmanId(t) }; }
  if (k && aboneKey) {
    const hk = `hediye:${k}`; const g = await env.HAK.get(hk, "json");
    if (g && KATMANLAR[katmanId(g.katman)]) {
      const sahip = kim ? "u:" + kim.uid : "c:" + cihaz; g.kullanan = g.kullanan || [];
      if (!g.kullanan.includes(sahip) && g.kullanan.length < (g.adet || 1)) {
        const bitis = new Date(Date.now() + (g.gun || 30) * 864e5).toISOString();
        await env.HAK.put(aboneKey, JSON.stringify({ katman: katmanId(g.katman), bitis, kaynak: "hediye:" + k }), { expirationTtl: Math.ceil((g.gun || 30) * 86400 + 86400) });
        g.kullanan.push(sahip); g.son = new Date().toISOString(); await env.HAK.put(hk, JSON.stringify(g));
        return { katman: katmanId(g.katman), bitis, hediye: true };
      }
    }
  }
  return { katman: "ucretsiz" };
}
// Tam erişim kodunun ayrı sayacı ve sınırları (kod sızarsa harcamayı sınırlamak için)
const tamSinir = env => { const g = +env.TAM_GUNLUK || 40; return { ...KATMANLAR.elmas, gunluk: g, haftalik: g * 7, derinAylik: g * 31 }; };
const HEDIYE_HARF = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // karışan harfler (0/O, 1/I) yok
function hediyeKodu() { const r = crypto.getRandomValues(new Uint8Array(8)); const h = [...r].map(x => HEDIYE_HARF[x % HEDIYE_HARF.length]).join(""); return `LOGOS-${h.slice(0, 4)}-${h.slice(4)}`; }

async function sayaclar(env, sahip) {
  const z = zaman(); const key = `h:${sahip}`;
  const s = (await env.HAK.get(key, "json")) || {};
  return { z, key, gun: s.gun === z.gun ? s.gn || 0 : 0, hafta: s.hafta === z.hafta ? s.hn || 0 : 0, ay: s.ay === z.ay ? s.dn || 0 : 0 };
}
function kalanlar(katman, c, kOzel) {
  const k = kOzel || KATMANLAR[katman];
  return { katman, gunluk: k.gunluk, haftalik: k.haftalik, derinAylik: k.derinAylik,
    gunKalan: Math.max(0, k.gunluk - c.gun), haftaKalan: Math.max(0, k.haftalik - c.hafta), derinKalan: Math.max(0, k.derinAylik - c.ay) };
}

/* ---------- Profil doğrulama ---------- */
const BURCLAR = ["Koç", "Boğa", "İkizler", "Yengeç", "Aslan", "Başak", "Terazi", "Akrep", "Yay", "Oğlak", "Kova", "Balık"];
const kisalt = (s, n) => String(s ?? "").slice(0, n);
function profilTemizle(p) {
  if (!p || typeof p !== "object" || !/^\d{4}-\d{2}-\d{2}$/.test(p.dt || "") || !BURCLAR.includes(p.burc)) return null;
  const burc = x => BURCLAR.includes(x) ? x : "";
  const o = p.onay && typeof p.onay === "object" ? { tarih: kisalt(p.onay.tarih, 30), surum: kisalt(p.onay.surum, 8), dil: kisalt(p.onay.dil, 5), kosullar: !!p.onay.kosullar, aktarim: !!p.onay.aktarim, yas18: !!p.onay.yas18 } : null;
  const pz = p.pazarlama && typeof p.pazarlama === "object" ? { onay: !!p.pazarlama.onay, tarih: kisalt(p.pazarlama.tarih, 30), surum: kisalt(p.pazarlama.surum, 8) } : { onay: false };
  return { ad: kisalt(p.ad, 30), dt: p.dt, saat: /^\d{1,2}:\d{2}$/.test(p.saat || "") ? p.saat : "", il: kisalt(p.il, 30), burc: p.burc, ay: burc(p.ay), yk: burc(p.yk),
    ykElle: !!p.ykElle, niyet: kisalt(p.niyet, 16), onay: o, pazarlama: pz };
}

/* ---------- Bölge ----------
   Hizmet yalnızca IZINLI_ULKELER (wrangler.toml, ör. "TR") listesindeki ülkelerden kullanılabilir.
   Ülke bilgisi Cloudflare'in IP'den belirlediği ülke kodudur. */
const ulkeBul = req => String(req.cf?.country || req.headers.get("cf-ipcountry") || "XX").toUpperCase();
const izinliMi = (env, u) => (env.IZINLI_ULKELER || "TR").split(",").map(x => x.trim().toUpperCase()).filter(Boolean).some(x => x === "*" || x === u);
const yonetici = (env, url) => !!env.ADMIN_ANAHTARI && url.searchParams.get("anahtar") === env.ADMIN_ANAHTARI;
async function sha(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("").slice(0, 24); }
// IP başına günlük basit sınır (bekleme listesi ve bildirim için)
async function ipSinir(env, req, tur, en) {
  const k = `s:${tur}:${req.headers.get("cf-connecting-ip") || "?"}:${zaman().gun}`; const n = +(await env.HAK.get(k)) || 0;
  if (n >= en) return false; await env.HAK.put(k, String(n + 1), { expirationTtl: 60 * 60 * 26 }); return true;
}

export default {
  async fetch(req, env) {
    try { return await isle(req, env); }
    catch (e) { console.log("hata", e?.stack || e); return json({ kod: "sunucu", mesaj: "Sunucuda beklenmeyen bir hata oluştu." }, 500, corsHeaders(req, env)); }
  },
};

async function isle(req, env) {
  {
    const cors = corsHeaders(req, env); const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!cors["access-control-allow-origin"] && req.headers.get("origin")) return json({ kod: "izin_yok", mesaj: "Bu adresten erişime izin verilmiyor." }, 403, {});

    const ulke = ulkeBul(req), izinli = izinliMi(env, ulke) || incelemeMi(env, req.headers.get("x-logos-kod") || url.searchParams.get("kod"));

    if (url.pathname === "/api/bolge" && req.method === "GET") return json({ ulke, izinli }, 200, cors);

    // Türkiye dışı bekleme listesi: e-posta, ülke, dil (açık rıza ile)
    if (url.pathname === "/api/bekleme" && req.method === "POST") {
      let b; try { b = await req.json(); } catch { return json({ kod: "istek" }, 400, cors); }
      const eposta = String(b.eposta || "").trim().toLowerCase().slice(0, 120);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta) || b.onay !== true) return json({ kod: "istek" }, 400, cors);
      if (!(await ipSinir(env, req, "b", 5))) return json({ kod: "cok_istek" }, 429, cors);
      await env.HAK.put(`b:${ulke}:${await sha(eposta)}`, JSON.stringify({ eposta, ulke, dil: String(b.dil || "").slice(0, 5), tarih: new Date().toISOString(), onaySurum: String(b.onaySurum || "1").slice(0, 8) }), { expirationTtl: 60 * 60 * 24 * 730 });
      return json({ tamam: true }, 200, cors);
    }

    // Yönetici: hediye kodu üret. Örnek: /api/yonetim/hediye?anahtar=...&katman=elmas&gun=30&adet=1&say=1
    //   katman: gumus | altin | elmas · gun: planın süresi (gün) · adet: bir kodu kaç kişi kullanabilir · say: kaç farklı kod
    if (url.pathname === "/api/yonetim/hediye" && req.method === "GET") {
      if (!yonetici(env, url)) return json({ kod: "izin_yok" }, 403, cors);
      const katman = katmanId(url.searchParams.get("katman") || "elmas");
      if (katman === "ucretsiz") return json({ kod: "istek", mesaj: "katman gumus, altin veya elmas olmalı" }, 400, cors);
      const gun = Math.min(366, Math.max(1, +url.searchParams.get("gun") || 30));
      const adet = Math.min(1000, Math.max(1, +url.searchParams.get("adet") || 1));
      const say = Math.min(50, Math.max(1, +url.searchParams.get("say") || 1));
      const not = String(url.searchParams.get("not") || "").slice(0, 80);
      const kodlar = [];
      for (let i = 0; i < say; i++) { const kd = hediyeKodu(); kodlar.push(kd);
        await env.HAK.put(`hediye:${kd}`, JSON.stringify({ katman, gun, adet, kullanan: [], not, olusturma: new Date().toISOString() }), { expirationTtl: 60 * 60 * 24 * 365 }); }
      return json({ kodlar, katman, gun, adet, gecerlilik: "Kullanılmayan kod 1 yıl sonra silinir." }, 200, cors);
    }

    // Yönetici: kampanya e-postası izni veren kullanıcılar (İYS kaydı ve gönderim için)
    if (url.pathname === "/api/yonetim/pazarlama" && req.method === "GET") {
      if (!yonetici(env, url)) return json({ kod: "izin_yok" }, 403, cors);
      const liste = []; let cursor; do { const l = await env.HAK.list({ prefix: "pz:", cursor }); for (const k of l.keys) liste.push(await env.HAK.get(k.name, "json")); cursor = l.list_complete ? null : l.cursor; } while (cursor);
      return json({ adet: liste.length, liste }, 200, cors);
    }

    // Yönetici: bekleme listesi özeti ve içerik bildirimleri (ADMIN_ANAHTARI gizli değeriyle)
    if (url.pathname === "/api/yonetim" && req.method === "GET") {
      if (!yonetici(env, url)) return json({ kod: "izin_yok" }, 403, cors);
      const say = {}; let cursor; do { const l = await env.HAK.list({ prefix: "b:", cursor }); for (const k of l.keys) { const u = k.name.split(":")[1]; say[u] = (say[u] || 0) + 1; } cursor = l.list_complete ? null : l.cursor; } while (cursor);
      const r = await env.HAK.list({ prefix: "r:", limit: 50 });
      const bildirimler = await Promise.all(r.keys.map(async k => ({ id: k.name, ...(await env.HAK.get(k.name, "json")) })));
      const hl = await env.HAK.list({ prefix: "hediye:", limit: 100 });
      const hediyeler = await Promise.all(hl.keys.map(async k => { const g = await env.HAK.get(k.name, "json") || {}; return { kod: k.name.slice(7), katman: g.katman, gun: g.gun, adet: g.adet, kullanilan: (g.kullanan || []).length, not: g.not || "" }; }));
      const ayar = { tamErisimKoduTanimli: !!env.TAM_ERISIM_KODU, testKoduSayisi: (env.PREMIUM_KODLARI || "").split(",").filter(x => x.includes(":")).length, yapayZekaAnahtariTanimli: !!env.ANTHROPIC_API_KEY };
      return json({ ayar, bekleme: say, bildirimler, hediyeler }, 200, cors);
    }


    /* ---------- Hesap verisi: profil, onaylar, kampanya izni, okuma geçmişi ----------
       KV: "hesap:<uid>" = {profil, guncelleme}, "gecmis:<uid>" = [okumalar], "pz:<uid>" = kampanya e-postası izni (yalnızca izin verenler) */
    if (url.pathname.startsWith("/api/hesap")) {
      const kim = await kimlikDogrula(req, env); if (!kim) return json({ kod: "giris_gerek" }, 401, cors);
      const hk = `hesap:${kim.uid}`, gk = `gecmis:${kim.uid}`, pk = `pz:${kim.uid}`;
      if (url.pathname === "/api/hesap" && req.method === "GET") {
        const [h, g] = await Promise.all([env.HAK.get(hk, "json"), env.HAK.get(gk, "json")]);
        return json({ profil: h?.profil || null, gecmis: g || [] }, 200, cors);
      }
      if (url.pathname === "/api/hesap/profil" && req.method === "PUT") {
        let b; try { b = await req.json(); } catch { return json({ kod: "istek" }, 400, cors); }
        const p = profilTemizle(b.profil); if (!p) return json({ kod: "istek" }, 400, cors);
        const eski = (await env.HAK.get(hk, "json"))?.profil;
        // Kampanya izni: açık rıza kaydı (tarih, dil, e-posta, metin sürümü). Geri alınırsa kayıt silinir.
        if (p.pazarlama?.onay) { if (!eski?.pazarlama?.onay || eski.pazarlama.tarih !== p.pazarlama.tarih) await env.HAK.put(pk, JSON.stringify({ eposta: kim.eposta, dil: p.onay?.dil || "", tarih: p.pazarlama.tarih, surum: p.pazarlama.surum })); }
        else await env.HAK.delete(pk);
        await env.HAK.put(hk, JSON.stringify({ profil: p, guncelleme: new Date().toISOString() }));
        return json({ tamam: true }, 200, cors);
      }
      if (url.pathname === "/api/hesap/gecmis" && req.method === "PUT") {
        let b; try { b = await req.json(); } catch { return json({ kod: "istek" }, 400, cors); }
        const g = Array.isArray(b.gecmis) ? b.gecmis.slice(0, 40) : null; if (!g) return json({ kod: "istek" }, 400, cors);
        const s = JSON.stringify(g); if (s.length > 600000) return json({ kod: "buyuk" }, 413, cors);
        await env.HAK.put(gk, s); return json({ tamam: true }, 200, cors);
      }
      // Hesap silme: sunucudaki tüm hesap verileri silinir (KVKK md. 7). Firebase hesabı uygulama tarafından ayrıca silinir.
      if (url.pathname === "/api/hesap" && req.method === "DELETE") {
        await Promise.all([hk, gk, pk, `abone:${kim.uid}`, `h:u:${kim.uid}`].map(k => env.HAK.delete(k)));
        return json({ tamam: true }, 200, cors);
      }
      return json({ kod: "bulunamadi" }, 404, cors);
    }

    if (!izinli && url.pathname.startsWith("/api/")) return json({ kod: "bolge", ulke, mesaj: "Logos henüz bölgende kullanılamıyor." }, 451, cors);

    // Yapay zekâ içeriği bildirimi (Google Play yapay zekâ içerik politikası)
    if (url.pathname === "/api/bildir" && req.method === "POST") {
      let b; try { b = await req.json(); } catch { return json({ kod: "istek" }, 400, cors); }
      const neden = ["uygunsuz", "yanlis", "zararli", "diger"].includes(b.neden) ? b.neden : "diger";
      if (!(await ipSinir(env, req, "r", 10))) return json({ kod: "cok_istek" }, 429, cors);
      const kayit = { neden, not: String(b.not || "").slice(0, 400), metin: String(b.metin || "").slice(0, 12000), picks: Array.isArray(b.picks) ? b.picks.slice(0, 6) : [], dil: String(b.dil || "").slice(0, 5), mod: String(b.mod || "").slice(0, 8), okuma: String(b.okuma || "").slice(0, 24), tarih: new Date().toISOString() };
      await env.HAK.put(`r:${Date.now()}:${crypto.randomUUID().slice(0, 8)}`, JSON.stringify(kayit), { expirationTtl: 60 * 60 * 24 * 90 });
      return json({ tamam: true }, 200, cors);
    }

    if (url.pathname === "/api/hak" && req.method === "GET") {
      const cihaz = (url.searchParams.get("cihaz") || "").slice(0, 64);
      if (!cihaz) return json({ kod: "istek", mesaj: "Cihaz kimliği eksik." }, 400, cors);
      const kim = await kimlikDogrula(req, env);
      const pl = await katmanBul(env, url.searchParams.get("kod"), kim, cihaz);
      const kal = pl.sinirsiz ? kalanlar("elmas", await sayaclar(env, pl.sayac || "tam"), tamSinir(env)) : kalanlar(pl.katman, await sayaclar(env, kim ? "u:" + kim.uid : cihaz));
      return json({ ...kal, hesap: !!kim, tamErisim: !!pl.sinirsiz, bitis: pl.bitis || null, hediye: !!pl.hediye }, 200, cors);
    }

    if (url.pathname === "/api/okuma" && req.method === "POST") {
      let b; try { b = await req.json(); } catch { return json({ kod: "istek", mesaj: "Geçersiz istek." }, 400, cors); }
      const cihaz = String(b.cihaz || "").slice(0, 64);
      const hata = !cihaz ? "Cihaz kimliği eksik." : validatePicks(D, b.picks);
      if (hata) return json({ kod: "istek", mesaj: hata }, 400, cors);
      const pr = b.profil || {};
      const P = { burc: SIGN[pr.burc] ? pr.burc : null, yk: SIGN[pr.yk] ? pr.yk : "", ay: SIGN[pr.ay] ? pr.ay : "", niyet: ["genel", "iliski", "yol", "ic"].includes(pr.niyet) ? pr.niyet : "genel", soru: String(pr.soru || "").slice(0, 200) };
      if (!P.burc) return json({ kod: "istek", mesaj: "Burç bilgisi eksik." }, 400, cors);

      const kim = await kimlikDogrula(req, env);
      const pl = await katmanBul(env, b.kod, kim, cihaz); const katman = pl.katman;
      const k = pl.sinirsiz ? tamSinir(env) : KATMANLAR[katman];
      const c = await sayaclar(env, pl.sinirsiz ? (pl.sayac || "tam") : kim ? "u:" + kim.uid : cihaz); // hesaplı kullanıcıda haklar hesaba bağlıdır
      const kal = kalanlar(katman, c, k);
      // Hesapsız ücretsiz kullanımda cihaz kimliği değiştirilerek sınırın aşılmasını önlemek için IP başına günlük üst sınır
      const ipKey = !kim && katman === "ucretsiz" ? `ip:${req.headers.get("cf-connecting-ip") || "?"}:${c.z.gun}` : null;
      const ipSay = ipKey ? +(await env.HAK.get(ipKey)) || 0 : 0;
      if (ipKey && ipSay >= (+env.IP_GUNLUK || 6)) return json({ kod: "hak_bitti", mesaj: "Bugünkü okuma hakkın doldu.", ...kal, gunKalan: 0 }, 429, cors);
      if (kal.gunKalan <= 0 || kal.haftaKalan <= 0) return json({ kod: "hak_bitti", mesaj: kal.gunKalan <= 0 ? "Bugünkü okuma hakkın doldu." : "Bu haftaki okuma hakkın doldu.", ...kal }, 429, cors);
      let mod = pl.sinirsiz && OKUMALAR[b.mod] ? b.mod : k.okuma; // tam erişimde istenen okuma türü denenebilir
      if (b.mod === "derin" && k.okuma === "tam" && kal.derinKalan > 0) mod = "derin";
      if (mod === "derin" && kal.derinKalan <= 0) mod = "tam"; // Altın / Elmas aylık derin sınırı dolduysa tam okumaya düşer

      const A = analyze(D, b.picks, P);
      const dil = DIL_PAKETI[b.dil] && DILLER[b.dil]?.hazir ? b.dil : "tr";
      const yerel = dil === "tr" ? null : yerelIstem(dil, DIL_PAKETI[dil][0], DIL_PAKETI[dil][1], A.cs);
      // Aynı kişinin son okumaları (yalnızca kart kodları ve tarih; tekrar eden kartı bağlamak için)
      const kodlar = new Set(D.cards.map(x => x.kod));
      const gecmis = (Array.isArray(b.gecmis) ? b.gecmis : []).slice(0, 3).map(g => ({ tarih: String(g?.tarih || "").slice(0, 30), picks: (Array.isArray(g?.picks) ? g.picks : []).slice(0, 6).map(p => ({ kod: String(p?.kod || ""), o: p?.o === "Y" ? "Y" : "D" })).filter(p => kodlar.has(p.kod)) })).filter(g => g.picks.length && !isNaN(Date.parse(g.tarih)));
      const p = buildPrompt(D, A, P, mod, yerel, { zaman: Date.now(), gecmis });
      const up = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: p.model, max_tokens: p.maxTokens, stream: true, ...(OKUMALAR[mod]?.ek || {}), system: p.system, messages: [{ role: "user", content: p.user }] }),
      });
      if (!up.ok || !up.body) {
        console.log("anthropic", up.status, await up.text().catch(() => ""));
        return json({ kod: "yz_hata", mesaj: "Yorum şu an üretilemiyor. Biraz sonra tekrar dene." }, 502, cors);
      }
      // Hak, yapay zekâ yanıtı başladıktan sonra düşülür
      const derin = mod === "derin";
      if (ipKey) await env.HAK.put(ipKey, String(ipSay + 1), { expirationTtl: 60 * 60 * 26 });
      await env.HAK.put(c.key, JSON.stringify({ gun: c.z.gun, hafta: c.z.hafta, ay: c.z.ay, gn: c.gun + 1, hn: c.hafta + 1, dn: c.ay + (derin ? 1 : 0) }), { expirationTtl: 60 * 60 * 24 * 40 });

      // Anthropic olay akışını düz metne çevir
      // Metin gelmeden biterse (ör. sınır, ret, akış hatası) uygulamaya "\u0001HATA:<sebep>" satırı gönderilir.
      const dec = new TextDecoder(), enc = new TextEncoder(); let buf = "", metinVar = false, durus = "", akisHata = "";
      const ts = new TransformStream({
        transform(chunk, ctl) {
          buf += dec.decode(chunk, { stream: true });
          let i; while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!line.startsWith("data:")) continue;
            try {
              const ev = JSON.parse(line.slice(5));
              if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta" && ev.delta.text) { metinVar = true; ctl.enqueue(enc.encode(ev.delta.text)); }
              else if (ev.type === "message_delta" && ev.delta?.stop_reason) durus = ev.delta.stop_reason;
              else if (ev.type === "error") akisHata = ev.error?.type || "error";
            } catch {}
          }
        },
        async flush(ctl) {
          if (durus && durus !== "end_turn") console.log("durus", durus, mod);
          if (!metinVar) {
            console.log("bos_yanit", durus, akisHata, mod);
            ctl.enqueue(enc.encode("\u0001HATA:" + (akisHata || durus || "bos")));
            // Yorum gelmediyse düşülen hak geri verilir
            await env.HAK.put(c.key, JSON.stringify({ gun: c.z.gun, hafta: c.z.hafta, ay: c.z.ay, gn: c.gun, hn: c.hafta, dn: c.ay }), { expirationTtl: 60 * 60 * 24 * 40 });
            if (ipKey) await env.HAK.put(ipKey, String(ipSay), { expirationTtl: 60 * 60 * 26 });
          }
        },
      });
      return new Response(up.body.pipeThrough(ts), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-mod": mod, "x-gun-kalan": String(kal.gunKalan - 1), "x-hafta-kalan": String(kal.haftaKalan - 1), ...cors } });
    }
    return json({ kod: "yok", mesaj: "Bulunamadı." }, 404, cors);
  }
}
