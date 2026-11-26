// Kriz içeriği denetimi (uygulama ve sunucu ortak kullanır).
// Soru metninde intihar / kendine zarar verme ifadesi varsa okuma yapılmaz; kullanıcı 112'ye yönlendirilir.
// Basit anahtar sözcük denetimidir; amaç kriz anında kart yorumu üretmemektir, tanı koymak değildir.
const KALIP = [
  // Türkçe (harfler sadeleştirilmiş: ı→i, ş→s, ğ→g, ü→u, ö→o, ç→c)
  "intihar", "kendimi oldur", "kendimi oldurmek", "olmek istiyorum", "olsem daha iyi", "yasamak istemiyorum", "yasamak istemiyor",
  "canima kiy", "kendime zarar", "kendime kiy", "bilegimi kes", "bileklerimi kes", "hayatima son ver", "hayatimi sonlandir",
  "yasamanin anlami yok", "artik yasamak", "zehir icip",
  // İngilizce
  "suicide", "suicidal", "kill myself", "end my life", "want to die", "self harm", "self-harm", "hurt myself", "cut myself", "better off dead",
  // Almanca
  "selbstmord", "suizid", "mich umbringen", "sterben will", "mir das leben nehmen", "mich ritzen", "nicht mehr leben",
  // Rusça
  "самоубий", "суицид", "убить себя", "покончить с собой", "хочу умереть", "не хочу жить", "порезать себя",
  // Arapça
  "انتحار", "اقتل نفسي", "أقتل نفسي", "اريد ان اموت", "أريد أن أموت", "انهي حياتي", "أنهي حياتي", "ايذاء نفسي", "إيذاء نفسي",
];
const sade = s => String(s || "").toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/\s+/g, " ");
// Kalıp bir sözcük başında aranır ("bölmek istiyorum" gibi yanlış eşleşmeler olmasın diye)
export const krizVar = metin => { const m = " " + sade(metin).replace(/[^\p{L}\p{N}\s-]/gu, " ") + " "; return m.trim() !== "" && KALIP.some(k => m.includes(" " + k)); };
