// Katman (abonelik) kuralları ve okuma türleri.
// Hem uygulama hem sunucu bu dosyayı kullanır. Sunucu, kullanım haklarını bu değerlere göre denetler.
// Bir sınırı değiştirmek için yalnızca buradaki sayıyı değiştirin ve sunucuyu yeniden yayınlayın.
// derinAylik: ayda en fazla kaç Derin Okuma. okuma "derin" olan katmanlarda sınır dolunca okuma "tam" olur.
// reklam: true ise ücretsiz okuma, ödüllü reklam izlendikten sonra açılır (reklam altyapısı Android sürümüyle gelecek).

export const KATMANLAR = {
  ucretsiz: { ad: "Ücretsiz", gunluk: 1, haftalik: 2, okuma: "kisa",  derinAylik: 0,  reklam: true },
  gumus:    { ad: "Gümüş",    gunluk: 1, haftalik: 4, okuma: "tam",   derinAylik: 2 },
  altin:    { ad: "Altın",    gunluk: 2, haftalik: 6, okuma: "derin", derinAylik: 10 },
  elmas:    { ad: "Elmas",    gunluk: 2, haftalik: 7, okuma: "derin", derinAylik: 30 },
};
export const UCRETLI = ["gumus", "altin", "elmas"];

// Eski katman adları (önceki test kodları ve cihaz kayıtları için)
const ESKI = { premium: "gumus", premiumPlus: "altin" };
export const katmanId = k => KATMANLAR[k] ? k : ESKI[k] || "ucretsiz";

// Türkiye fiyatları (KDV dahil, aylık). Diğer ülkelerde fiyat Google Play'den, yerel para birimiyle gelir.
export const FIYAT_TR = { gumus: "124,99 TL", altin: "199,99 TL", elmas: "249,99 TL" };

// Google Play abonelik ürünleri: ürün kimliği → katman. Her ürünün tek temel planı "aylik" (otomatik yenilenen, aylık).
// Play Console > Para kazanın > Abonelikler bölümünde aynı kimliklerle oluşturulmalıdır.
export const PLAY_URUN = { logos_gumus: "gumus", logos_altin: "altin", logos_elmas: "elmas" };
export const PLAY_PLAN = "aylik";
export const playUrunu = katman => Object.keys(PLAY_URUN).find(u => PLAY_URUN[u] === katman);

// Okuma türleri: hangi model, en fazla kaç token çıktı, hedef uzunluk.
// Claude 5.5 modelleri varsayılan olarak önce "düşünür"; düşünme de max_tokens'tan harcar.
// ek: isteğe eklenen ayarlar. Haiku'da ve Sonnet'te yazmadan önceki düşünme kapalı (her model kendi değerini kabul eder).
// max_tokens yalnızca üst sınırdır; ücret kullanılan kadar ödenir.
export const OKUMALAR = {
  kisa:  { ad: "Kısa okuma",  model: "claude-haiku-5-5",  maxTokens: 3000, kelime: "300–400", ek: { thinking: { type: "disabled" }, output_config: { effort: "medium" } } },
  tam:   { ad: "Tam okuma",   model: "claude-haiku-5-5",  maxTokens: 5000, kelime: "650–850", ek: { thinking: { type: "disabled" }, output_config: { effort: "medium" } } },
  derin: { ad: "Derin okuma", model: "claude-sonnet-5-5", maxTokens: 5000, kelime: "650–850", ek: { thinking: { type: "between_tools" }, output_config: { effort: "medium" } } },
};

// Android'de reklam iznini vermeyen Ücretsiz kullanıcı: reklam yok, her gün 1 kısa okuma (haftada 7)
export const UCRETSIZ_REKLAMSIZ = { ad: "Ücretsiz", gunluk: 1, haftalik: 7, okuma: "kisa", derinAylik: 0, reklam: false };
