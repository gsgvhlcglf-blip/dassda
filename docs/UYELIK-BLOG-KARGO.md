# Üyelik, Blog ve Kargo Takip

Üst menü sırası: Ana Sayfa → Motosikletler → Hakkımızda → Blog → İletişim. Sağ üstte tek Hesabım bağlantısı bulunur: giriş yapılmamışsa giriş/kayıt ekranına, giriş yapılmışsa hesaba açılır. Koleksiyon bağlantısı üst ve alt menüden kaldırılmıştır; katalog ürün ve alışveriş bağlantıları üzerinden kullanılabilir. Kargo Takip alt bilgide Kullanım Koşulları'nın hemen yanındadır. Mobil menü aynı sırayı korur.

## Blog yazısı eklemek

Tarayıcı panelinde Veri paneli → Sayfa içerikleri → Blog yazısı ekle. Yazının URL adını (küçük harf ve tire), başlığını ve içeriğini girip kaydedin. Yazı Blog sayfasında görünür. TR/EN/RU alanları ayrı düzenlenebilir; eksik çeviride Türkçe içerik gösterilir. Bir yazıyı açıp metne tıklayarak da düzenleyebilirsiniz. Bunlar tarayıcı taslaklarıdır ve JSON yedeğine dahildir.

Gerçek uygulamanın güvenli yönetim panelinde Yapılandırma → Blog yazısı ekle aynı içerik tablosunu kullanır. `blog-` ile başlayan sayfa anahtarının devamı yazının adresidir. Kaydetmek yazıyı yayımlar; ayrı taslak/yayın tarihi alanı henüz yoktur. Yeni CMS koleksiyonu veya uygulama kodu gerekmez.

## Kargo takibini açmak

Firma seçilene kadar sayfada hizmetin henüz yapılandırılmadığı gösterilir. Takip numarası ve teslimat durumu uydurulmaz.

Tarayıcı panelinde Veri paneli → Taslak & yedek → Kargo takip ayarları; gerçek yönetim panelinde Yapılandırma → Firma ve takip bağlantısı:

1. Kargo firmasının adını yazın.
2. Firmanın doğruladığı resmi HTTPS takip bağlantısını ekleyin.
3. Firma takip numarasını URL içinde kabul ediyorsa numara yerine `{tracking}` yazın. Kullanıcı numarasını girince bu alan otomatik doldurulur ve firmanın sayfası yeni sekmede açılır.
4. Firma yalnızca genel bir takip formu sunuyorsa bu formun adresini ekleyin. Müşteri numarasını açılan sayfaya ayrıca yapıştırır; arayüz bunu açıklar.
5. Bağlantıyı boş bırakıp kaydetmek hizmeti kapatır.

Bu aşama kargo firmasına yönlendirmedir. Gönderi hareketlerini kendi sitemizde göstermek için seçilen firmanın resmi API hesabı/anahtarları, izinleri ve dokümantasyonu gerekir. Anahtarlar yalnızca sunucu ortamında tutulmalı; API istekleri sunucuda yapılmalı; siparişe ait bilgiler yalnızca ilgili üyeye veya yetkili yöneticilere gösterilmelidir. Sonraki entegrasyon siparişe firma/takip numarası atama, sunucuda durum sorgulama, destekleniyorsa webhook ve e-posta/SMS bildirimlerini kapsayabilir. Bunlar şu anda bağlı değildir; firma belli olunca gerçek API'ye göre geliştirilir.

## Satın almadan önce üyelik

Katalog gezmek ve sepet hazırlamak serbesttir. Sipariş adımı için giriş gerekir. Anonim ziyaretçi girişe yönlendirilir, giriş/kayıt sonrası sepeti korunarak sipariş adımına döner. `/api/orders` oturum olmadan 401 döndürür. Supabase RPC de kimliği/e-postası doğrulanmış üyeyi zorunlu tutar. Siparişin sahibi ve e-postası sunucudan alınır; tarayıcının gönderdiği müşteri kimliği dikkate alınmaz. Hesabım yalnızca oturum sahibinin siparişlerini gösterir. Üyelik yönetici yetkisi vermez.

Kurulumsuz HTML önizlemede gerçek hesap, şifre veya sipariş saklanmaz. Giriş/kayıt alanları kapalıdır; “Örnek üye ile devam et” yalnızca bu sekmede demo üyelik durumunu açar. Gerçek sipariş gönderimi kapalı kalır.

## Gerçek uygulamanın kurulumu

- Supabase SQL Editor'de önce `001_store.sql`, ardından `002_customer_membership.sql` çalıştırın. Mevcut projede yalnızca 002'yi ekleyin; eski siparişler korunur. 002 zorunludur: doğrudan anonim sipariş RPC erişimini de kapatır.
- Supabase Authentication içinde Email sağlayıcısını ve e-posta doğrulamasını açın. Site URL'yi gerçek HTTPS alan adınıza ayarlayın, izin verilen yönlendirmelere `https://alan-adiniz/auth/callback` ekleyin. Sunucunun `NEXT_PUBLIC_SITE_URL` değeri aynı alan adı olmalıdır.
- Gerçek e-posta gönderimi için Supabase SMTP ayarlarını ve üretim limitlerini tamamlayın. Harici servis bilgileri verilmediği için bu ortamda gerçek e-posta teslimatı doğrulanamaz.
- `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` yapılandırılır. Service role anahtarı kullanılmaz. Yetkiler RLS ile korunur.
- Yerel Next.js demosunda ayrı `customers` tablosu ve imzalı HttpOnly müşteri oturumu kullanılır; şifreler tuzlu scrypt özeti olarak tutulur. Yerel hesaplarda e-posta doğrulaması yoktur ve bu arayüzde belirtilir. Yerel demo kamuya açık üretimde etkinleştirilmez.
- Mevcut ödeme adımı sipariş talebidir. Gerçek kart ödemesi için ayrıca ödeme sağlayıcısı kurulmalıdır. Şifre sıfırlama/self servis hesap silme akışı bu değişiklik kapsamında eklenmemiştir; üretim yayını öncesi müşteri hesap yönetimiyle birlikte tamamlanmalıdır.
