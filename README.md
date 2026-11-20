# Logos — Kurulum ve Geliştirme Rehberi

Bu klasör uygulamanın ilk çalışan sürümüdür (0.1.0). Uygulama bir **PWA**'dır: telefonda uygulama gibi açılan bir web uygulaması. Aynı kod daha sonra Google Play'e Android uygulaması olarak paketlenir.

## Klasörler

| Klasör / dosya | Ne işe yarar |
|---|---|
| `app.config.js` | **Değiştireceğiniz her şey burada:** uygulama adı, sunucu adresi, Canva görsel/video yuvaları, renkler, sürüm |
| `index.html`, `css/`, `js/` | Uygulama ekranları |
| `shared/` | Okuma motoru, katman kuralları ve yapay zekâ talimatı (uygulama ve sunucu ortak kullanır) |
| `shared/katmanlar.js` | Ücretsiz / Premium / Premium+ hakları ve hangi Claude modelinin kullanılacağı |
| `data/deste.json` | 36 kartın tüm verisi (Excel'den + mitoloji katmanı) |
| `assets/cards/` | Kart görselleri (`S1-K1.webp` … `S6-K6.webp`) |
| `assets/ui/` | Canva'dan gelecek arayüz görselleri ve videoları |
| `assets/icons/` | Uygulama simgeleri (geçici) |
| `worker/` | Sunucu katmanı (Cloudflare Worker): Claude bağlantısı ve kullanım hakları |
| `sw.js`, `manifest.webmanifest` | Çevrimdışı çalışma ve "ana ekrana ekle" ayarları |

## Üç çalışma modu

1. **Demo modu:** `API_URL` boşsa. Yorumlar yapay zekâ olmadan kart verisinden örnek olarak üretilir. Arayüzü test etmek için.
2. **Önizleme modu:** Uygulama claude.ai içinde açıldığında. Yorumlar sizin Claude hesabınızla üretilir. Gerçek yorum kalitesini test etmek için.
3. **Sunucu modu:** `API_URL` doluysa. Gerçek uygulama; yorumlar Cloudflare Worker üzerinden Claude API'den gelir.

Demo ve önizleme modunda Profil sayfasından katman (Ücretsiz/Premium/Premium+) seçip test edebilir, hak sayacını sıfırlayabilirsiniz.

---

## Adım 1 — Bilgisayarda açıp denemek

Uygulama doğrudan çift tıklayarak açılmaz (tarayıcı güvenliği modül dosyalarını engeller). En kolay yol VS Code:

1. VS Code'u açın → **Dosya › Klasör Aç** → bu klasörü seçin.
2. Sol menüde **Uzantılar**'a (dört kare simgesi) tıklayın, `Live Server` aratıp **Yükle**'ye basın.
3. `index.html` dosyasına sağ tıklayın → **Open with Live Server**.
4. Tarayıcı açılır. Telefon görünümü için `F12` → üstteki telefon simgesi.

## Adım 2 — İnternette yayınlamak (GitHub Pages, ücretsiz)

1. github.com'da oturum açın → sağ üst **+** → **New repository**.
2. Ad: `fal-uygulamasi` · **Public** seçin → **Create repository**.
3. Açılan sayfada **uploading an existing file** bağlantısına tıklayın.
4. Bu klasördeki her şeyi (`worker` klasörü hariç) sürükleyip bırakın → **Commit changes**.
5. Repo'da **Settings › Pages** → *Branch*: `main`, klasör: `/ (root)` → **Save**.
6. 1–2 dakika sonra adres görünür: `https://KULLANICIADI.github.io/fal-uygulamasi/`

> Android paketleme için uygulamanın bir alan adının kök dizininde yayınlanması gerekir (Adım 5'e bakın). Test için yukarıdaki adres yeterli.

## Adım 3 — Sunucuyu kurmak (Cloudflare Worker + Claude API)

**Gerekenler:** Cloudflare hesabı (ücretsiz), Anthropic hesabı ve API anahtarı, bilgisayarda Node.js.

### 3.1 Claude API anahtarı
1. console.anthropic.com → oturum açın → **Billing**'den kredi yükleyin (ör. 10 USD ile başlayın).
2. **Settings › Limits**'ten aylık harcama sınırı koyun. Bu, beklenmedik maliyete karşı en önemli korumadır.
3. **API Keys › Create Key** → anahtarı kopyalayın. Anahtarı kimseyle paylaşmayın, uygulama dosyalarına yazmayın.

### 3.2 Node.js
nodejs.org → **LTS** sürümünü indirip kurun (Sonraki, Sonraki…).

### 3.3 Worker'ı yayınlamak
VS Code'da **Terminal › New Terminal** açın ve sırayla yazın:

```
cd worker
npx wrangler login
```
Tarayıcı açılır, Cloudflare'e izin verin.

```
npx wrangler kv namespace create HAK
```
Çıktıdaki `id = "..."` değerini kopyalayın, `worker/wrangler.toml` dosyasında `BURAYA_KV_ID` yerine yapıştırın.

`wrangler.toml` içinde `ALLOWED_ORIGINS` değerine GitHub Pages adresinizi yazın (ör. `https://KULLANICIADI.github.io`). Sonra:

```
npx wrangler secret put ANTHROPIC_API_KEY
```
Sorulduğunda Claude API anahtarını yapıştırıp Enter'a basın.

```
npx wrangler secret put PREMIUM_KODLARI
```
Test kodlarını yazın, ör. `deneme-p:premium,deneme-pp:premiumPlus`

```
npx wrangler deploy
```
Çıktıda sunucu adresi görünür: `https://fal-sunucu.KULLANICIADI.workers.dev`

### 3.4 Uygulamayı sunucuya bağlamak
1. `app.config.js` → `API_URL: "https://fal-sunucu.KULLANICIADI.workers.dev"` yazın.
2. `VERSION` değerini artırın (ör. `0.1.1`), `sw.js` içindeki `SURUM` değerini de aynı şekilde değiştirin.
3. Değişen dosyaları GitHub'a yeniden yükleyin.
4. Premium'u test etmek için uygulamada **Profil › Test kodu** alanına tanımladığınız kodu girin.

## Adım 4 — Değişiklik yapmak

### Uygulama adı belli olduğunda
1. `app.config.js` → `APP_NAME` ve istenirse `APP_SLOGAN`.
2. `manifest.webmanifest` → `name` ve `short_name`.
3. `index.html` → `<title>` satırı.
4. `VERSION` ve `sw.js` içindeki `SURUM` değerini artırın, dosyaları yükleyin.

### Kart görseli değiştirmek
- Yeni görseli aynı adla `assets/cards/` içine koyun (ör. `S2-K3.webp`). Önerilen boyut: 600 px genişlik, 400:640 oranı.
- PNG kullanacaksanız `app.config.js` → `CARD_IMAGE` satırında `.webp` yerine `.png` yazın (o zaman 36 kartın hepsi PNG olmalı).
- WebP'ye çevirmek için squoosh.app kullanabilir ya da görseli Claude'a gönderebilirsiniz.

### Canva görsel ve videoları
`assets/ui/MEDYA-REHBERI.md` dosyasına bakın.

### Haklar ve modeller
`shared/katmanlar.js` → günlük/haftalık sınırlar, aylık derin okuma sayısı, model adları. Değişiklikten sonra hem uygulamayı hem sunucuyu (`npx wrangler deploy`) güncelleyin.

## Adım 5 — Android uygulaması (sonraki aşama)

1. Uygulamayı kendi alan adınızda yayınlayın (ör. `uygulamaadi.com`). GitHub Pages özel alan adını destekler.
2. pwabuilder.com → adresi girin → **Package for stores › Android** → paketi indirin.
3. Paketle gelen `assetlinks.json` dosyasını sitede `/.well-known/` klasörüne koyun.
4. Google Play Console'da geliştirici hesabı açın ve paketi yükleyin.

## Bilinen sınırlar (bu sürüm)

- **Hak sayacı cihaz kimliğine bağlı.** Uygulama verisi silinirse sayaç sıfırlanır. Hesap sistemiyle (sonraki aşama) kalıcı olacak.
- **Satın alma yok.** Premium sayfası fiyatları gösterir; Google Play aboneliği sonraki aşamada eklenecek. Şimdilik test kodlarıyla denenir.
- **Ödüllü reklam yok.** Google'ın mobil reklam sistemi (AdMob) PWA içinde doğrudan çalışmaz; yerel bir Android kabuğu gerekir. Karar sonraki aşamada verilecek.
- **Aydınlatma metni taslaktır.** Yayından önce hukukçuya kontrol ettirin.
- **Okuma geçmişi yalnızca cihazda saklanır.**

## Maliyet özeti (19.11.2026 fiyatları, 1 USD ≈ 50,42 TL)

| Okuma | Model | Okuma başına |
|---|---|---|
| Kısa (Ücretsiz) | Claude Haiku 5.5 | ≈ 0,05 TL |
| Tam (Premium) | Claude Haiku 5.5 | ≈ 0,09 TL |
| Derin (Premium+ ve Premium'da ayda 2) | Claude Sonnet 5.5 | ≈ 1,82 TL |

Claude API faturası dolar bazlıdır; yurt dışı hizmet alımı için sorumlu sıfatıyla KDV doğar. Muhasebecinize teyit ettirin.
