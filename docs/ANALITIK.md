# Analitik ve ısı haritası

## Tarayıcı çalışma panelinde deneme

1. Önizlemede **Veri paneli → Analitik & Isı Haritası** bölümünü açın.
2. **Test kaydını aç → Müşteri önizlemesini aç** düğmelerini kullanın.
3. Açılan müşteri sekmesinde çerez bildiriminden **Kabul et** seçin (önceden reddettiyseniz alt bilgide **Çerez tercihleri** açın). Ardından **Test kaydını başlat** düğmesine basın. Sayfalarda gezinin, tıklayın ve aşağı kaydırın.
4. Panele dönün. Sayılar otomatik yenilenir; **Yenile** düğmesi de kullanılabilir. Isı haritasında sayfayı ve kayıtlı ekran ölçüsünü seçin.

Bu bölüm yalnızca aynı tarayıcı profili ve aynı adres kökenindeki kendi testlerinizi kaydeder. Gerçek müşteri istatistiği değildir. Editör ve ısı haritası kendi tıklamalarını kaydetmez. Veriler son 30 gün / en fazla 2.500 olay olarak tarayıcıda tutulur. Tarayıcı verileri silinirse bu kayıtlar kaybolur. **Veriyi indir** raporu JSON olarak dışa aktarır; taslak ürün yedeğinden ayrıdır. **Kayıtları sil** geri alınamaz.

## Gerçek uygulamada kayıt

- Supabase kullanılıyorsa önce mevcut 001 ve 002 göçlerinden sonra `supabase/migrations/003_analytics.sql` dosyasını SQL Editor veya migration aracıyla uygulayın. Yerel SQLite uygulaması tabloları kendisi oluşturur. İlave servis hesabı gerekmiyor.
- Yönetici hesabıyla `/admin` üzerinden **Analitik & Isı Haritası** bölümünü açın. Editör rolü bu rapora ve ayarlara erişemez.
- Başlangıçta kayıt kapalıdır. **Kaydı aç** ile etkinleştirin ve 7, 30 veya 90 günlük saklama süresi seçin.
- Ziyaretçiye istatistik izni sunulur. Kayıt yalnızca izin sonrası başlar; reddetme ve **Çerez tercihleri → Reddet** desteklenir. Do Not Track / Global Privacy Control tercihleri kaydı engeller.
- Dağıtımda `NEXT_PUBLIC_ANALYTICS_REVISION` değerini tasarım sürümüne göre değiştirin (örn. `2026-11-v1`). Yalnızca harf, rakam, alt çizgi ve kısa çizgi; en fazla 64 karakter. Bu bir genel sürüm etiketidir, gizli anahtar değildir.

Kaydedilenler: rastgele sekme oturum kimliği, yalnızca izin verilen genel sayfa yolu, sunucunun olay zamanı, olay türü, ekran/belge ölçüleri, sayfa üzerindeki yuvarlanmış tıklama konumu, en derin kaydırma oranı, harici yönlendiren sitenin alan adı ve tasarım sürümü. Oturum sayısı tekil insan sayısı değildir. Aynı sekmenin sayfaları birlikte değerlendirilir; yeni sekmeler ayrı oturum olabilir.

Form değerleri, tuş vuruşları, ekran videosu, kullanıcı kimliği, IP veya tarayıcı kimlik bilgileri analitik tablosuna kaydedilmez. Sorgu parametreleri, hesap, giriş, sepet ve ödeme sayfaları kayda alınmaz. Barındırma sağlayıcısının kendi erişim günlükleri bu özellikten ayrıdır. Gizlilik metni yönetim panelinden düzenlenebilir; gerçek işletme için kaydın amacı ve saklama süresi bu metne eklenmelidir.

Raporlar: günlük görüntülemeler, sekme oturumları, tıklamalar, ortalama en derin kaydırma, ilk 50 sayfa, cihaz türü ve ilk 20 kaynak alan adı. Rapor günleri Türkiye saatine göre hesaplanır. Kaydırma ortalaması oturum/sayfa başına en yüksek orandan üretilir. İzin vermeyen ziyaretçiler sayılmadığından sayılar bütün trafiği temsil etmez.

Isı haritası tıklamaları ekran ölçüsü ve tasarım sürümüne göre ayırır, 40 × 100 konum hücresinde birleştirir. Seçilen ekran ölçüsünde **sayfanın güncel tasarımı** gösterilir. Geçmiş ekran görüntüleri veya ziyaretçi videoları saklanmaz; daha sonra sayfa düzeni değiştiyse eski konumlar birebir örtüşmeyebilir. Harita içindeki sayfa gezinmeye kapalıdır, iç kaydırma yapılabilir. Saydamlık ayarı yalnızca görselleştirmeyi değiştirir.

Supabase Row Level Security olay tablolarının kamuya okunmasını/yazılmasını engeller. Olay ekleme yalnızca doğrulanan, izin bayrağı taşıyan, sınırlı olay paketlerini kabul eden RPC ile yapılır. HTTP katmanı ayrıca köken, şema ve istek sınırlarını denetler. Rapor, ayar ve silme işlemleri sunucuda ve veritabanında yönetici yetkisi ister. Supabase servis anahtarı kullanılmaz. Dışa aktarılan rapor anonim oturum kimlikleri içermez.

Saklama süresi dolan kayıtlar yeni olay alındığında ve yönetici özet raporu istendiğinde temizlenir. Sakin dönemlerde de tam zamanında fiziksel silme isteniyorsa Supabase tarafında günlük bir zamanlanmış silme işi yapılandırın. Isı haritası sorguları her durumda saklama süresinin dışındaki olayları hariç tutar. Yerel uygulama kayıtları kalıcı `.data/store.sqlite` dosyasındadır; Vercel üzerinde Supabase kullanılmalıdır.

## Kontroller

```sh
node --import tsx tests/analytics.test.ts
node scripts/test-analytics-preview.mjs
npm run build
node scripts/test-analytics-app.mjs
```

Son komut geçici, izole bir SQLite veritabanı ve rastgele test kimlik bilgileriyle üretim sunucusunu başlatır. Chromium gerektirir. Gerçek panel kayıtlarını değiştirmez.

## Alışveriş akışı

`004_analytics_funnel.sql` göçü ile alışveriş akışı raporu eklenir. Mevcut gerçek Supabase kurulumunda 003'ten sonra uygulanmalıdır. Yerel uygulama ve tarayıcı testi aynı hesaplamayı kullanır.

Akış: **Marka seçimi ekranı → Marka seçildi → Model seçildi → Uyumlu ürünler → Ürün incelendi → Başarıyla sepete eklendi**. Sayaçlar bu adımları sırayla tamamlayan sekme oturumlarını gösterir. Mobil, tablet ve masaüstü filtresi oturumun akışa başladığı ekran ölçüsüne göre çalışır. Bir aşamaya dönüp tekrar tıklamak oturum sayısını şişirmez. Ürüne doğrudan girenler ayrı toplam olarak gösterilir; zorunlu motosiklet seçimi hunisine dahil edilmez.

Her adımın bir önceki adımdan geçiş oranı ve o adıma henüz ulaşmayan oturum sayısı görünür. “Ulaşmadı” sayısı kesin vazgeçme sebebi değildir: dönem sonunda ziyaretine devam edenler ve farklı bir gezinme yolu kullananlar da buna dahildir. Sepete ekleme ödeme veya satış değildir. Hesap, sepet ve ödeme sayfalarının izlenmeme kuralı korunur; yeni olay yalnızca genel ürün sayfasındaki başarılı sepete ekleme işlemidir. Form değerleri ve ürün miktarları olaya eklenmez.
