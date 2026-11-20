# Canva Medya Rehberi

Canva'da hazırladığınız görsel ve videoları bu klasöre koyun, sonra `app.config.js` içindeki `MEDIA` bölümüne dosya yolunu yazın.
Boş bırakılan yuvada uygulamanın kendi tasarımı kullanılır; yani istediğiniz kadarını, istediğiniz sırayla ekleyebilirsiniz.

| Yuva (`MEDIA` içindeki ad) | Nerede görünür | Canva ölçüsü | Dışa aktarma | Önerilen dosya adı |
|---|---|---|---|---|
| `logo` | Giriş ekranı ve üst başlık | 512 × 512 px, şeffaf arka plan | PNG (şeffaf arka plan işaretli) | `logo.png` |
| `introVideo` | İlk açılış ekranı | 1080 × 1920 px (dikey) | MP4, en fazla 8 sn, sessiz, en fazla 5 MB | `giris.mp4` |
| `introPoster` | Video yüklenirken kapak | 1080 × 1920 px | PNG ya da JPG (WebP'ye çevrilebilir) | `giris-kapak.webp` |
| `homeBackground` | Ana sayfa arka planı | 1080 × 1920 px | JPG/WebP, en fazla 400 KB; koyu tonlar (yazılar üstünde okunmalı) | `ana-arka-plan.webp` |
| `waitingVideo` | Yorum beklenirken (yuvarlak çerçevede) | 600 × 600 px (kare) | MP4, 2–4 sn, döngüye uygun, sessiz, en fazla 1 MB | `bekleme.mp4` |
| `cardBack` | Kapalı kartların arka yüzü | 400 × 640 px (veya 800 × 1280) | PNG/WebP | `kart-arkasi.webp` |

## Koruyucu figürler (karga)

Her setin bir koruyucu kargası var. Okumanın sonunda en çok kartı çıkan setin koruyucusu açılış sahnesinde ve sonuç ekranında gösterilir (eşitlikte ya da altı kart farklı setlerdeyse Kader kartının seti).

| Dosya | Set | Koruyucu |
|---|---|---|
| `G-S1.webp` | Aetherion (Aztek) | Güneş Kargası |
| `G-S2.webp` | Prometheion (Yunan) | Defne Kargası |
| `G-S3.webp` | Ragnarion (İskandinav) | Hafıza Kuzgunu |
| `G-S4.webp` | Alcherion (Aborjin) | Kızıl Toprak Kargası |
| `G-S5.webp` | Duation (Mısır) | Ankh Kargası |
| `G-S6.webp` | Samsarion (Uzakdoğu) | Kader Kargası |

- Canva'dan dışa aktarma: 1080 × 1350 px, şeffaf arka planlı PNG, yazısız, figür ortada.
- Uygulamaya koymadan önce 720 × 900 WebP'ye çevrilir (6 görsel toplam ~0,7 MB; PNG hâli ~11,6 MB idi). Görseli değiştirirseniz PNG'yi bana gönderin, ben çeviririm.
- Klasör: `assets/ui/koruyucular/`.
- Koruyucu adları ve sözleri `js/koruyucu.js` dosyasındaki `TEMA` bölümündedir.

## Örnek

```js
MEDIA: {
  logo: "assets/ui/logo.png",
  introVideo: "assets/ui/giris.mp4",
  introPoster: "",
  homeBackground: "assets/ui/ana-arka-plan.webp",
  waitingVideo: "",
  cardBack: "assets/ui/kart-arkasi.webp",
},
```

## Dikkat

- **Dosya boyutu hızı belirler.** Videolar telefonda ilk açılışta indirilir; büyük video, bekleme süresi demektir.
- **Videolar sessiz olmalı.** Telefonlar sesli videoyu kendiliğinden başlatmaz.
- **Ses eklenecekse** ayrı bir yuva gerekir; isterseniz ekleriz.
- Yeni dosya ekledikten sonra `app.config.js` içindeki `VERSION` ve `sw.js` içindeki `SURUM` değerini artırın; yoksa telefonlar eski sürümü göstermeye devam edebilir.
- Başka bir ekrana (ör. okuma sonucu arka planı, set tanıtım videoları) medya eklemek isterseniz söyleyin, yeni yuva açarım.
