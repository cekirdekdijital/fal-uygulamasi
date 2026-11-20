// Uygulamanın dilleri. Hem uygulama hem sunucu kullanır.
// hazir: true olan dillerin metin dosyası (i18n/xx.json) ve kart çevirisi (data/kartlar/xx.json) vardır.
// Yeni bir dil hazır olduğunda yalnızca "hazir" değerini true yapın (ve sunucuda worker/src/index.js içindeki DIL_PAKETI'ne ekleyin).
// yazi: yazı tipi grubu · yon: "rtl" sağdan sola

export const DILLER = {
  tr: { ad: "Türkçe",                     yerel: "tr-TR", yazi: "latin", hazir: true,  istem: "Türkçe" },
  en: { ad: "English",                    yerel: "en-GB", yazi: "latin", hazir: true,  istem: "English" },
  de: { ad: "Deutsch",                    yerel: "de-DE", yazi: "latin", hazir: false, istem: "Deutsch" },
  es: { ad: "Español",                    yerel: "es-ES", yazi: "latin", hazir: false, istem: "Español" },
  fr: { ad: "Français",                   yerel: "fr-FR", yazi: "latin", hazir: false, istem: "Français" },
  ru: { ad: "Русский",                    yerel: "ru-RU", yazi: "kiril", hazir: false, istem: "Русский" },
  ar: { ad: "العربية",                    yerel: "ar",    yazi: "arap",  hazir: true,  istem: "العربية الفصحى", yon: "rtl",
        istemNot: "Hitapta tekil eril genel kullanımı (أنت) kullan; arayüzle uyumlu kalsın. Rakamları 1, 2, 3 biçiminde yaz." },
  ja: { ad: "日本語",                      yerel: "ja-JP", yazi: "ja",    hazir: false, istem: "日本語" },
  ko: { ad: "한국어",                      yerel: "ko-KR", yazi: "ko",    hazir: false, istem: "한국어" },
  bs: { ad: "Bosanski · Hrvatski · Srpski", yerel: "bs",  yazi: "latin", hazir: false, istem: "bosanski/hrvatski/srpski (latinica)" },
  sq: { ad: "Shqip",                      yerel: "sq-AL", yazi: "latin", hazir: false, istem: "Shqip" },
  bg: { ad: "Български",                  yerel: "bg-BG", yazi: "kiril", hazir: false, istem: "Български" },
  mk: { ad: "Македонски",                 yerel: "mk-MK", yazi: "kiril", hazir: false, istem: "Македонски" },
  ro: { ad: "Română",                     yerel: "ro-RO", yazi: "latin", hazir: false, istem: "Română" },
  el: { ad: "Ελληνικά",                   yerel: "el-GR", yazi: "yunan", hazir: false, istem: "Ελληνικά" },
};

// Tarayıcı dil kodundan uygulama diline (hr ve sr de bs dosyasını kullanır)
const ESLE = { hr: "bs", sr: "bs", sh: "bs", cnr: "bs" };
export function dilEsle(kod) {
  const k = String(kod || "").toLowerCase().split(/[-_]/)[0];
  const d = ESLE[k] || k;
  return DILLER[d]?.hazir ? d : null;
}

/** Yorum isteminde (prompt) kullanılacak yerel bilgileri hazırlar. */
export function yerelIstem(dil, metin, kartlar, cs) {
  if (!dil || dil === "tr" || !DILLER[dil]?.hazir) return null;
  const s = k => metin?.[k] ?? "";
  return {
    dil, dilAd: DILLER[dil].istem,
    kartAd: Object.fromEntries(cs.map(c => [c.kod, kartlar?.cards?.[c.kod]?.ad || c.ad])),
    pos: [0, 1, 2, 3, 4, 5].map(i => s(`pos.${i}.ad`)),
    dikey: s("konum.D"), yatay: s("konum.Y"),
    basliklar: { kopru: s("istem.kopru"), bag: s("istem.bag"), gok: s("istem.gok"), kapanis: s("istem.kapanis") },
    uyari: s("istem.uyari"), uyariTam: s("istem.uyariTam"), not: DILLER[dil].istemNot || "",
  };
}
