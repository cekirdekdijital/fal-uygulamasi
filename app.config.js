// ============================================================
//  UYGULAMA AYARLARI — değiştirmeniz gereken her şey burada.
//  Bu dosyayı Not Defteri ile açıp değerleri değiştirebilirsiniz.
//  Tırnak işaretlerini ve virgülleri silmeyin.
// ============================================================

export const CONFIG = {
  // Uygulamanın adı. Değiştirirseniz manifest.webmanifest içindeki "name" ve index.html içindeki <title> da değişmeli.
  APP_NAME: "Logos",
  APP_SLOGAN: "Altı kart, altı mitoloji, tek yolculuk", // Ekranda görünen slogan dil dosyasındadır (i18n/xx.json: intro.slogan)

  // Sunucu (Cloudflare Worker) adresi. Boş bırakılırsa uygulama "demo modu"nda çalışır:
  // yorumlar yapay zekâ olmadan, kart verisinden örnek olarak üretilir.
  // Örnek: "https://fal-sunucu.KULLANICIADI.workers.dev"
  API_URL: "https://fal-sunucu.cekirdekdijital.workers.dev",

  // Kart görsellerinin yolu. {kod} yerine kart kodu (S1-K1 gibi) gelir.
  // Görselleri PNG olarak koyacaksanız ".webp" yerine ".png" yazın.
  CARD_IMAGE: "assets/cards/{kod}.webp",
  // Türkçe dışındaki dillerde kullanılan uluslararası (-ion adlı) kart görselleri.
  CARD_IMAGE_INT: "assets/cards/int/{kod}.webp",

  // Koruyucu karga görselleri. {set} yerine S1 … S6 gelir. Dosya yoksa uygulamanın kendi çizimi görünür.
  GUARDIAN_IMAGE: "assets/ui/koruyucular/G-{set}.webp",

  // Canva'dan gelecek arayüz görselleri ve videoları (assets/ui klasörüne koyun).
  // Boş ("") bırakılan yuvada uygulamanın kendi tasarımı kullanılır.
  MEDIA: {
    logo: "assets/ui/logo.webp", //           — giriş ve üst başlıkta logo (kare, şeffaf PNG)
    introVideo: "",      // ör. "assets/ui/giris.mp4"          — ilk açılış videosu (dikey 1080x1920, sessiz, en fazla 8 sn)
    introPoster: "",     // ör. "assets/ui/giris-kapak.webp"   — video yüklenirken görünen kapak
    homeBackground: "",  // ör. "assets/ui/ana-arka-plan.webp" — ana sayfa arka planı (dikey)
    waitingVideo: "",    // ör. "assets/ui/bekleme.mp4"        — yorum beklenirken dönen kısa döngü (sessiz)
    cardBack: "",        // ör. "assets/ui/kart-arkasi.webp"   — kapalı kartların arka yüzü (400x640 oranında)
  },

  // Renkler. Kart görsellerindeki mürekkep mavisi ve yıldız kırmızısından alındı.
  COLORS: {
    night: "#0e1124",
    accent: "#d65a4f",
    ink: "#8496e0",
  },

  // Hesap sistemi (Firebase Authentication). Firebase konsolundaki "Web uygulaması" ayarlarını buraya yapıştırın.
  // Boş bırakılırsa hesap bölümü görünmez; uygulama hesapsız (ücretsiz plan, cihaz bazlı) çalışır.
  // Bu değerler gizli değildir; Firebase bunların uygulamada görünmesini öngörür. Asıl güvenlik sunucudaki doğrulamadadır.
  FIREBASE: {
    apiKey: "",
    authDomain: "",   // ör. "logos-fal.firebaseapp.com"
    projectId: "",    // ör. "logos-fal" (sunucudaki FIREBASE_PROJECT_ID ile aynı olmalı)
    appId: "",
  },

  // Geliştirici görünümü: true iken çalışma modu etiketi, test planı seçici ve hak sıfırlama görünür.
  // Mağazaya göndermeden önce false yapın; kullanıcı yalnızca gerçek uygulamayı görür.
  GELISTIRICI: true,

  // Test için premium kodları sunucuda tanımlanır (README'ye bakın).
  // Uygulama mağazası satın alması bir sonraki aşamada eklenecek.
  STORE_READY: false,

  // Sürüm. Dosyaları güncellediğinizde bu sayıyı artırın; telefonlar yeni sürümü indirir.
  VERSION: "0.8.1",
};
