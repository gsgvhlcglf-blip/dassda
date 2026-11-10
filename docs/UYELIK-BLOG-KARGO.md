# Üyelik, Blog ve Kargo Takip

Üst menü sırası: Ana Sayfa → Motosikletler → Parçanı ürettir → Hakkımızda → Blog → İletişim. Müşteri üyeliği kapalıdır; sağ üstte yalnızca sepet bulunur. Koleksiyon bağlantısı üst ve alt menüden kaldırılmıştır; katalog ürün ve alışveriş bağlantıları üzerinden kullanılabilir. Kargo Takip alt bilgide Kullanım Koşulları'nın hemen yanındadır. Mobil menü aynı sırayı korur. Site ve müşteri önizlemesi şimdilik yalnızca Türkçedir; dil seçicisi kaldırılmıştır. Önceden kaydedilen çeviriler veri kaybı olmadan saklanır.

## Blog yazısı eklemek

Tarayıcı panelinde Veri paneli → Sayfa içerikleri → Blog yazısı ekle. Yazının URL adını (küçük harf ve tire), başlığını ve içeriğini girip kaydedin. Yazı Blog sayfasında görünür. TR/EN/RU alanları ayrı düzenlenebilir; eksik çeviride Türkçe içerik gösterilir. Bir yazıyı açıp metne tıklayarak da düzenleyebilirsiniz. Bunlar tarayıcı taslaklarıdır ve JSON yedeğine dahildir.

Gerçek uygulamanın güvenli yönetim panelinde Yapılandırma → Blog yazısı ekle aynı içerik tablosunu kullanır. `blog-` ile başlayan sayfa anahtarının devamı yazının adresidir. Kaydetmek taslağı günceller; canlıya almak için Yayın & sürümler → Taslağı yayınla kullanılır. Ayrı yazı yayın tarihi alanı henüz yoktur. Yeni CMS koleksiyonu veya uygulama kodu gerekmez.

## Blog bannerleri ve sayfalama

Her yazı, konu başlığı görselin içinde olan bir banner kartıyla listelenir. Kartlar sırayı koruyan asimetrik satırlara yerleşir; uzun başlıklar daha geniş alan alır. Başlık kesilmez, gerektiğinde banner yüksekliği artar. Mobilde kartlar alt alta gelir.

Her sayfada en fazla **10 yazı** bulunur. 11. yazıdan itibaren altta sayfa numaraları ve önceki/sonraki bağlantıları gösterilir. `/blog?page=2` gibi adresler paylaşılabilir; ikinci sayfadan yazı açıp Blog'a dönünce aynı liste sayfası korunur.

Kapak değiştirmek için:

1. **Sayfa önizlemeleri → Blog** açıp **Düzenleme modu**nu etkinleştirin.
2. Bannerın görsel kısmına tıklayın; **Yeni fotoğraf seç** alanından JPEG/PNG/WebP yükleyin (en fazla 5 MB). Başlığa tıklamak metni düzenler.
3. Fotoğraf, o yazının sabit kaydına bağlanır. Başka yazıları, ana sayfa fotoğraflarını veya yazı metnini değiştirmez. Aynı kapak yazının iç sayfasında da kullanılır.
4. Değişiklik tarayıcı taslağına otomatik kaydolur ve tasarım yedeğine dahil edilir. Diğer tarayıcı/cihaz için mevcut **Yayın & sürümler** akışını kullanın.

Yeni yazı eklendiğinde uygulama kodu veya ayrı koleksiyon gerekmeden kendi bannerı oluşur. Bu düzenleme örnek yazıları gerçek içeriğinize eklemez. Yazı yoksa boş durum mesajı görünür; kapak henüz yüklenmemişse düzenleme sırasında görsel ekleme işareti gösterilir. Yazıları hazırlarken konuya uygun ve kullanım hakkı bulunan kapak görsellerini de ekleyin.

## Kargo takibini açmak

Firma seçilene kadar sayfada hizmetin henüz yapılandırılmadığı gösterilir. Takip numarası ve teslimat durumu uydurulmaz.

Tarayıcı panelinde Veri paneli → Taslak & yedek → Kargo takip ayarları; gerçek yönetim panelinde Yapılandırma → Firma ve takip bağlantısı:

1. Kargo firmasının adını yazın.
2. Firmanın doğruladığı resmi HTTPS takip bağlantısını ekleyin.
3. Firma takip numarasını URL içinde kabul ediyorsa numara yerine `{tracking}` yazın. Kullanıcı numarasını girince bu alan otomatik doldurulur ve firmanın sayfası yeni sekmede açılır.
4. Firma yalnızca genel bir takip formu sunuyorsa bu formun adresini ekleyin. Müşteri numarasını açılan sayfaya ayrıca yapıştırır; arayüz bunu açıklar.
5. Bağlantıyı boş bırakıp kaydetmek hizmeti kapatır.

Bu aşama kargo firmasına yönlendirmedir. Gönderi hareketlerini kendi sitemizde göstermek için seçilen firmanın resmi API hesabı/anahtarları, izinleri ve dokümantasyonu gerekir. Anahtarlar yalnızca sunucu ortamında tutulmalı; API istekleri sunucuda yapılmalı; siparişe ait bilgiler yalnızca ilgili üyeye veya yetkili yöneticilere gösterilmelidir. Sonraki entegrasyon siparişe firma/takip numarası atama, sunucuda durum sorgulama, destekleniyorsa webhook ve e-posta/SMS bildirimlerini kapsayabilir. Bunlar şu anda bağlı değildir; firma belli olunca gerçek API'ye göre geliştirilir.

## Üyeliksiz satın alma

Sepetten ödeme formuna doğrudan geçilir. Hesap açılmaz, şifre istenmez.
`/giris` ve `/uye-ol` ödeme sayfasına yönlenir; müşteri kayıt/giriş API'si 410
döndürür. Yönetici girişi ayrı ve korumalıdır. Eski müşteri/sipariş kayıtları
silinmez. İndirmesiz önizleme gerçek müşteri bilgisi veya sipariş toplamaz.

Sunucu ilk geçerli siparişte 256 bit rastgele HttpOnly/SameSite=Lax oturum
çerezi oluşturur; veritabanında yalnızca SHA-256 özeti tutulur. Sipariş, ödeme
ve kargo durumu bu oturuma göre ayrılır; e-posta veya sipariş numarası bir
erişim anahtarı değildir. `/siparislerim` aynı tarayıcıdaki son 50 siparişi
gösterir. Çerez 30 gün geçerlidir; silinirse destek için sipariş numarası gerekir.

## Gerçek uygulamanın kurulumu

Supabase göçlerini 001–017 sırasıyla uygulayın. 017 misafir checkout işlevlerini
yalnızca service_role erişimine açar; anonim tablo/RPC okuması açılmaz.
SUPABASE_SERVICE_ROLE_KEY sadece sunucuda tutulur. Yerel SQLite ilişkisel demo
otomatik göç eder. Gerçek tahsilat için ayrıca PayTR/iyzico ayarları gerekir.
MySQL şeması hazırlanmıştır; canlı adaptör veya bağlantı bu aşamada kurulmaz.
