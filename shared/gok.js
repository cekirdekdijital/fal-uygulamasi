// Gök katmanı: okumanın yapıldığı andaki gökyüzü ve burç düzeyinde açılar.
// Hesaplar dış servis kullanmaz; Güneş ve Ay boylamı basit gök mekaniği formülleriyle bulunur
// (Ay için yaklaşık ±2° doğruluk; burç sınırına çok yakınsa "geçişte" denir).
import { SIGNS } from "./motor.js";

export const BURC_ADLARI = ["Koç", "Boğa", "İkizler", "Yengeç", "Aslan", "Başak", "Terazi", "Akrep", "Yay", "Oğlak", "Kova", "Balık"];

// Burç özleri: nitelik, ışık yönü, gölge yönü (yorum dili için; kesin karakter hükmü değildir)
export const BURC_OZ = {
  "Koç":     { nit: "Öncü",     isik: "cesaret, başlatma, öncülük",          golge: "sabırsızlık, öfkeyle hareket" },
  "Boğa":    { nit: "Sabit",    isik: "istikrar, beden ve değer, sebat",      golge: "inat, değişime direnç" },
  "İkizler": { nit: "Değişken", isik: "merak, iletişim, öğrenme",             golge: "dağınıklık, yüzeyde kalma" },
  "Yengeç":  { nit: "Öncü",     isik: "yuva, duygusal hafıza, koruma",        golge: "kabuğa çekilme, geçmişe takılma" },
  "Aslan":   { nit: "Sabit",    isik: "yaratıcılık, kalp, görünür olma",      golge: "gurur, onay ihtiyacı" },
  "Başak":   { nit: "Değişken", isik: "arınma, hizmet, ayrıntıya özen",       golge: "mükemmeliyetçilik, aşırı eleştiri" },
  "Terazi":  { nit: "Öncü",     isik: "denge, ilişki, adalet",                golge: "kararsızlık, kendini başkasında kaybetme" },
  "Akrep":   { nit: "Sabit",    isik: "dönüşüm, derinlik, gizli olanı görme", golge: "kontrol, bırakamama" },
  "Yay":     { nit: "Değişken", isik: "anlam arayışı, yolculuk, inanç",       golge: "aşırılık, kaçış" },
  "Oğlak":   { nit: "Öncü",     isik: "yapı, sorumluluk, kalıcı başarı",      golge: "katılık, yükü yalnız taşıma" },
  "Kova":    { nit: "Sabit",    isik: "özgürlük, gelecek, topluluk",          golge: "duygusal mesafe, kopukluk" },
  "Balık":   { nit: "Değişken", isik: "sezgi, şefkat, aşkınlık",              golge: "sınırsızlık, aldanış" },
};
export const NITELIK = { "Öncü": "başlatır", "Sabit": "sürdürür ve derinleştirir", "Değişken": "uyarlar ve dönüştürür" };

// Burç düzeyinde (whole-sign) açılar: iki burç arasındaki uzaklığa göre
const ACI = [
  { ad: "Kavuşum", anlam: "aynı burç: enerji yoğunlaşır, etki güçlenir" },
  { ad: "Komşu", anlam: "komşu burç: ince ayar ve farkındalık ister" },
  { ad: "Sekstil", anlam: "fırsat: çaba gösterilirse açılan destek" },
  { ad: "Kare", anlam: "gerilim: harekete geçiren sürtünme, ders" },
  { ad: "Üçgen", anlam: "akış: kendiliğinden gelen uyum ve destek" },
  { ad: "Ayar", anlam: "farklı diller: uyum için bilinçli ayar gerekir" },
  { ad: "Karşıt", anlam: "ayna: karşıt kutupta denge arayışı" },
];
export function burcAcisi(a, b) {
  const i = BURC_ADLARI.indexOf(a), j = BURC_ADLARI.indexOf(b);
  if (i < 0 || j < 0) return null;
  const d = Math.abs(i - j), u = Math.min(d, 12 - d);
  return ACI[u];
}

// Ay evreleri (Güneş–Ay uzanımı, 45° dilimler)
const EVRE = [
  { ad: "Yeni Ay", anlam: "tohum zamanı: niyet koymak, sessizce başlamak" },
  { ad: "Büyüyen Hilal", anlam: "ilk adımlar: niyeti beslemek, cesaret toplamak" },
  { ad: "İlk Dördün", anlam: "karar anı: engelle yüzleşip harekete geçmek" },
  { ad: "Büyüyen Şişkin Ay", anlam: "inceltme: emeği düzeltmek, sabırla olgunlaştırmak" },
  { ad: "Dolunay", anlam: "doruk: gizli olanın görünür olması, duyguların yükselmesi, tamamlanma" },
  { ad: "Küçülen Şişkin Ay", anlam: "hasat ve paylaşım: öğrenileni dağıtmak, şükran" },
  { ad: "Son Dördün", anlam: "bırakma: işe yaramayanı gözden geçirip çözmek" },
  { ad: "Küçülen Hilal", anlam: "dinlenme ve kapanış: döngüyü sessizce tamamlamak" },
];

const rad = x => x * Math.PI / 180, mod360 = x => ((x % 360) + 360) % 360;
function boylamlar(t) {
  const d = (t - Date.UTC(2000, 0, 1, 12)) / 864e5;
  const g = rad(357.528 + 0.9856003 * d);
  const gunes = mod360(280.460 + 0.9856474 * d + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
  const L = 218.316 + 13.176396 * d, M = rad(134.963 + 13.064993 * d), D = rad(297.850 + 12.190749 * d);
  const ay = mod360(L + 6.289 * Math.sin(M) - 1.274 * Math.sin(2 * D - M) + 0.658 * Math.sin(2 * D) - 0.186 * Math.sin(g));
  return { gunes, ay };
}
const burcu = (lon, pay) => { const i = Math.floor(lon / 30) % 12, r = lon % 30; return { burc: BURC_ADLARI[i], derece: Math.floor(r), gecis: r > 30 - pay ? BURC_ADLARI[(i + 1) % 12] : r < pay ? BURC_ADLARI[(i + 11) % 12] : null }; };

/** Okuma anının gökyüzü. t: milisaniye (varsayılan şimdi). */
export function gokyuzu(t = Date.now()) {
  const { gunes, ay } = boylamlar(t);
  const uz = mod360(ay - gunes);
  const evre = EVRE[Math.floor(mod360(uz + 22.5) / 45) % 8];
  return { gunes: burcu(gunes, 0.5), ay: burcu(ay, 2.5), evre, aydinlik: Math.round((1 - Math.cos(rad(uz))) / 2 * 100) };
}

/** Elementin burçlardaki karşılığı (motor.js SIGNS ile aynı kaynaktan) */
export const ELEMENT = Object.fromEntries(SIGNS.map(s => [s[0], s[3]]));
