# Taslak, yayın ve fotoğraf düzeni

## Kurulumsuz tarayıcı paneli

Mevcut ürünler, metinler, fotoğraflar ve logo ayarları taslakta korunur. Düzenlerken otomatik kayıt devam eder.

- **Müşteri önizlemesi**: taslağın ayrı sekmede açılan görünümü. Değişiklikler hemen yansır.
- **Yayımlananı gör**: yalnızca son yayımladığınız sürümü gösterir. Sonraki taslak düzenlemeleri bu görünümü değiştirmez.
- **Yayın & sürümler → Taslağı yayınla**: mevcut katalog ve görsel ayarları tek sürüm olarak kaydeder.
- **Bu sürüme dön**: seçtiğiniz sürümü geri getirir. Geri alma öncesindeki taslak ayrıca “Geri almadan önceki taslak” adıyla saklanır; bu kayda da dönebilirsiniz.

**Bu paneldeki yayın tarayıcı içindedir.** Aynı tarayıcı profili ve adres kökeni içinde çalışır. Domain veya internet yayını oluşturmaz. Gerçek uygulamadaki yönetim paneli aynı akışı veritabanıyla uygular.

Son 12 sürüm IndexedDB'de tutulur; büyük görselleri her sürüm için localStorage'a çoğaltmaz. Tarayıcı verileri silinirse sürümler kaybolur. “Taslak & yedek” dışa aktarımı o anki katalog ve görsel ayarları içerir; tüm sürüm geçmişini içermez. Dosyayı içe aktarmak taslağı günceller; yayımlanan görünümü değiştirmek için ayrıca Yayınla kullanın. Sürümler görsel yerleşim ayarları ve katalog içeriğidir; uygulama kodu sürümleri GitHub geçmişindedir.

## Bir parça veya modeli silmeden yayından kaldırma

**Veri paneli → Ürünler / Motosikletler → Düzenle → Yayında** işaretini kaldırıp **Değişiklikleri kaydet** düğmesine basın. Taslak müşteri önizlemesi hemen güncellenir. Son yayımlanan görünümü güncellemek için **Yayın & sürümler → Taslağı yayınla** kullanın.

Kayıt panelde **Yayında değil** olarak korunur. Modelin fotoğrafı, yılları ve uyumlulukları silinmez. Bir modeli kapatmak o modele bağlı parçaları genel katalogdan veya diğer modellerden kaldırmaz. Tekrar göstermek için aynı kutucuğu işaretleyip kaydedin ve yayınlayın. Canlı Supabase kurulumunda `007_model_visibility.sql` göçünü önceki göçlerden sonra uygulayın.

## Fotoğraf düzeni

**Veri paneli → Fotoğraf düzeni** bölümünde:

- Ortak kadraj: kare 1:1, dikey 4:5 veya yatay 4:3.
- Ortak arka plan: koyu, açık veya mevcut ton.
- Yerleşim: ürünün tamamını göster veya kadrajı doldur.
- Ortak ölçek: %60–%120.

Ayarlar ürün kartlarına ve ana ürün fotoğraflarına uygulanır; ürün yazıları ve fiyatlar yerinde kalır. Saydam olmayan görsellerin kendi arka planı kaldırılmaz. Kaynak dosyalar yeniden boyanmaz veya kırpılarak değiştirilmez.

Bir görseli ayrıca ayarlamak için **Sayfa önizlemeleri → Düzenleme modu** açıkken ürün fotoğrafına tıklayın. Sağ tarafta ölçek (%50–%160), yatay/dikey konum ve çekim türü bulunur. Çekim türünü fotoğrafın gerçek içeriğine göre Genel görünüm, Doku detayı veya Yüzey detayı olarak seçin. Galeride seçilen etiket gösterilir. Ana ürün görselinin kadrajı ürün kartına da uygulanır.

Gerçek yakın çekim veya parlak/mat karşılaştırması için ilgili fotoğraflar yüklenmelidir. Sistem yeni ürün fotoğrafı, malzeme iddiası veya yüzey özelliği üretmez. Demo görselleri demo olarak kalır.

## Gerçek Next.js / Supabase uygulaması

Mevcut 001–003 göçlerinden sonra sırasıyla:

1. `supabase/migrations/004_analytics_funnel.sql`
2. `supabase/migrations/005_site_versions.sql`

Yeni kurulumda 001–005 dosyalarının tümünü sıra ile uygulayın. Yerel SQLite tabloları uygulama tarafından oluşturulur.

`/admin` içindeki ürün, model, yıl, uyumluluk, içerik ve görsel düzenlemeleri özel taslağa kaydedilir. `/taslak-onizleme` giriş korumalıdır. **Yayın & sürümler** bölümünden taslağı inceleyin, yayımlanan siteyi açın ve yönetici hesabıyla yayınlayın. Editörler taslak düzenleyebilir; yayınlama ve geri alma yalnızca yönetici içindir. RPC yetkileri ve Row Level Security sunucudaki kontrolleri tamamlar. Katalog tablolarına doğrudan istemci yazımı kapatılır.

Yayın, ilişkisel katalog tablolarını tek veritabanı işlemi içinde günceller. Sipariş fiyatları yayımlanan ürün ve varyantlardan hesaplanır. Hata olursa kısmi yayın oluşmaz. Birden fazla sekme aynı taslağı değiştirirse eski sürüm numarasıyla kaydetme/yayınlama reddedilir; güncel paneli yüklemek gerekir.

Stoklar ve sipariş durumları operasyonel verilerdir: stok alanında açıkça yaptığınız değişiklik anlık uygulanır; içerik yayını veya geri alma mevcut stokları geri sarmaz. Yeni taslak ürünün stoku ilk yayınında oluşturulur. Siparişlerin referans verdiği ürün/varyantın silinmesine veritabanı izin vermez; ürünü yayından kaldırın. Böyle bir kayıt içermeyen çok eski bir sürüme dönme işlemi de atomik olarak reddedilebilir.

Gerçek uygulamanın **Fotoğraf düzeni** bölümünde ortak ayarlar önizlenir ve taslağa kaydedilir; ardından Yayınla kullanılır. Fotoğraflar Supabase Storage veya yerel geliştirme yükleme klasöründe saklanır. Tarihi sürümlerin görsellerini de korumak için Storage dosyalarını silmeyin. Veritabanı ve Storage yedeği, içerik sürüm geçmişinden ayrıdır.

## Doğrulama

```sh
node --import tsx tests/studio.test.ts
npm run panel:build
TEST_PROVIDER=1 node scripts/test-studio-preview.mjs
npm run build
node scripts/test-studio-app.mjs
```

Testler örnek içerik ve izole veritabanı kullanır; gerçek sipariş veya ödeme oluşturmaz.
