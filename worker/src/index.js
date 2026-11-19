// Sunucu katmanı (Cloudflare Worker)
// - Claude API anahtarını gizli tutar (anahtar uygulamaya hiç gönderilmez)
// - Talimatı (prompt) sunucuda kurar; kullanıcı talimatı değiştiremez
// - Günlük, haftalık ve aylık hakları denetler
// Uç noktalar:  GET /api/hak   POST /api/okuma
import D from "../../data/deste.json";
import { KATMANLAR, OKUMALAR } from "../../shared/katmanlar.js";
import { analyze, validatePicks, SIGN } from "../../shared/motor.js";
import { buildPrompt } from "../../shared/prompt.js";

const json = (obj, status, cors) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", ...cors } });

function corsHeaders(req, env) {
  const origin = req.headers.get("origin") || "";
  const izinli = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const ok = izinli.includes("*") || izinli.includes(origin);
  return ok ? { "access-control-allow-origin": origin || "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type", "access-control-expose-headers": "x-mod,x-gun-kalan,x-hafta-kalan", vary: "origin" } : {};
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

// Test kodları: PREMIUM_KODLARI = "kod1:premium,kod2:premiumPlus"
function katmanBul(env, kod) {
  if (!kod) return "ucretsiz";
  for (const p of (env.PREMIUM_KODLARI || "").split(",")) { const [k, t] = p.split(":").map(s => s?.trim()); if (k && k === kod && KATMANLAR[t]) return t; }
  return "ucretsiz";
}

async function sayaclar(env, cihaz) {
  const z = zaman(); const key = `h:${cihaz}`;
  const s = (await env.HAK.get(key, "json")) || {};
  return { z, key, gun: s.gun === z.gun ? s.gn || 0 : 0, hafta: s.hafta === z.hafta ? s.hn || 0 : 0, ay: s.ay === z.ay ? s.dn || 0 : 0 };
}
function kalanlar(katman, c) {
  const k = KATMANLAR[katman];
  return { katman, gunluk: k.gunluk, haftalik: k.haftalik, derinAylik: k.derinAylik,
    gunKalan: Math.max(0, k.gunluk - c.gun), haftaKalan: Math.max(0, k.haftalik - c.hafta), derinKalan: Math.max(0, k.derinAylik - c.ay) };
}

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env); const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!cors["access-control-allow-origin"] && req.headers.get("origin")) return json({ kod: "izin_yok", mesaj: "Bu adresten erişime izin verilmiyor." }, 403, {});

    if (url.pathname === "/api/hak" && req.method === "GET") {
      const cihaz = (url.searchParams.get("cihaz") || "").slice(0, 64);
      if (!cihaz) return json({ kod: "istek", mesaj: "Cihaz kimliği eksik." }, 400, cors);
      const katman = katmanBul(env, url.searchParams.get("kod"));
      return json(kalanlar(katman, await sayaclar(env, cihaz)), 200, cors);
    }

    if (url.pathname === "/api/okuma" && req.method === "POST") {
      let b; try { b = await req.json(); } catch { return json({ kod: "istek", mesaj: "Geçersiz istek." }, 400, cors); }
      const cihaz = String(b.cihaz || "").slice(0, 64);
      const hata = !cihaz ? "Cihaz kimliği eksik." : validatePicks(D, b.picks);
      if (hata) return json({ kod: "istek", mesaj: hata }, 400, cors);
      const pr = b.profil || {};
      const P = { burc: SIGN[pr.burc] ? pr.burc : null, yk: SIGN[pr.yk] ? pr.yk : "", niyet: ["genel", "iliski", "yol", "ic"].includes(pr.niyet) ? pr.niyet : "genel", soru: String(pr.soru || "").slice(0, 200) };
      if (!P.burc) return json({ kod: "istek", mesaj: "Burç bilgisi eksik." }, 400, cors);

      const katman = katmanBul(env, b.kod); const k = KATMANLAR[katman];
      const c = await sayaclar(env, cihaz); const kal = kalanlar(katman, c);
      if (kal.gunKalan <= 0 || kal.haftaKalan <= 0) return json({ kod: "hak_bitti", mesaj: kal.gunKalan <= 0 ? "Bugünkü okuma hakkın doldu." : "Bu haftaki okuma hakkın doldu.", ...kal }, 429, cors);
      let mod = k.okuma;
      if (b.mod === "derin" && k.okuma === "tam" && kal.derinKalan > 0) mod = "derin";
      if (k.okuma === "derin" && kal.derinKalan <= 0) mod = "tam"; // Premium+ aylık derin sınırı aşıldıysa tam okumaya düşer

      const A = analyze(D, b.picks, P);
      const p = buildPrompt(D, A, P, mod);
      const up = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: p.model, max_tokens: p.maxTokens, stream: true, system: p.system, messages: [{ role: "user", content: p.user }] }),
      });
      if (!up.ok || !up.body) {
        console.log("anthropic", up.status, await up.text().catch(() => ""));
        return json({ kod: "yz_hata", mesaj: "Yorum şu an üretilemiyor. Biraz sonra tekrar dene." }, 502, cors);
      }
      // Hak, yapay zekâ yanıtı başladıktan sonra düşülür
      const derin = mod === "derin";
      await env.HAK.put(c.key, JSON.stringify({ gun: c.z.gun, hafta: c.z.hafta, ay: c.z.ay, gn: c.gun + 1, hn: c.hafta + 1, dn: c.ay + (derin ? 1 : 0) }), { expirationTtl: 60 * 60 * 24 * 40 });

      // Anthropic olay akışını düz metne çevir
      const dec = new TextDecoder(), enc = new TextEncoder(); let buf = "";
      const ts = new TransformStream({
        transform(chunk, ctl) {
          buf += dec.decode(chunk, { stream: true });
          let i; while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!line.startsWith("data:")) continue;
            try { const ev = JSON.parse(line.slice(5)); if (ev.type === "content_block_delta" && ev.delta?.text) ctl.enqueue(enc.encode(ev.delta.text)); } catch {}
          }
        },
      });
      return new Response(up.body.pipeThrough(ts), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-mod": mod, "x-gun-kalan": String(kal.gunKalan - 1), "x-hafta-kalan": String(kal.haftaKalan - 1), ...cors } });
    }
    return json({ kod: "yok", mesaj: "Bulunamadı." }, 404, cors);
  },
};
