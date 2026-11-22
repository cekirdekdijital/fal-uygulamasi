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

// Okuma türleri: hangi model, en fazla kaç token çıktı, hedef uzunluk.
export const OKUMALAR = {
  kisa:  { ad: "Kısa okuma",  model: "claude-haiku-5-5",  maxTokens: 1200, kelime: "300–400" },
  tam:   { ad: "Tam okuma",   model: "claude-haiku-5-5",  maxTokens: 2600, kelime: "650–850" },
  derin: { ad: "Derin okuma", model: "claude-sonnet-5-5", maxTokens: 2800, kelime: "650–850" },
};
