// Katman (abonelik) kuralları ve okuma türleri.
// Hem uygulama hem sunucu bu dosyayı kullanır. Sunucu, kullanım haklarını bu değerlere göre denetler.
// Bir sınırı değiştirmek için yalnızca buradaki sayıyı değiştirin ve sunucuyu yeniden yayınlayın.

export const KATMANLAR = {
  ucretsiz:    { ad: "Ücretsiz",  gunluk: 1, haftalik: 2, okuma: "kisa",  derinAylik: 0 },
  premium:     { ad: "Premium",   gunluk: 2, haftalik: 6, okuma: "tam",   derinAylik: 2 },
  premiumPlus: { ad: "Premium+",  gunluk: 2, haftalik: 6, okuma: "derin", derinAylik: 20 },
};

// Okuma türleri: hangi model, en fazla kaç token çıktı, hedef uzunluk.
export const OKUMALAR = {
  kisa:  { ad: "Kısa okuma",  model: "claude-haiku-5-5",  maxTokens: 1200, kelime: "300–400" },
  tam:   { ad: "Tam okuma",   model: "claude-haiku-5-5",  maxTokens: 2600, kelime: "650–850" },
  derin: { ad: "Derin okuma", model: "claude-sonnet-5-5", maxTokens: 2800, kelime: "650–850" },
};
