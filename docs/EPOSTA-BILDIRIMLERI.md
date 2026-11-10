# Sipariş, kargo ve fatura e-postaları

Bu çalışma servis hesabı açmaz veya canlı e-posta göndermez. Gerekli alanlar
sağlanınca çalışan sunucu uygulaması için altyapıyı hazırlar.

## Kurulum

1. Supabase göçlerini 001–020 sırasıyla uygulayın. 019 özel bildirim kuyruğunu ve
   sipariş/ödeme işlemiyle aynı transaction içinde çalışan tetikleyicileri ekler.
2. Resend üzerinde size ait gönderici alan adını doğrulayın. Sunucuda
   EMAIL_PROVIDER=resend ve RESEND_API_KEY ayarlayın. Satış adresini panelde
   Siparişler → E-posta tasarımları alanına yazın. İsteğe bağlı yanıt adresi de
   buradadır. ORDER_EMAIL_FROM / ORDER_EMAIL_REPLY_TO sunucudaki alternatif
   ayarlardır. Anahtarı tarayıcı paneline yazmayın.
3. Gerçek PayTR/iyzico doğrulaması sonrası sipariş özeti; kargo takip numarası
   yayımlandığında kargo e-postası kuyruğa girer. Eski siparişlere toplu gönderim
   yapılmaz. Demo/test, bekleyen veya doğrulanmamış ödeme e-posta üretmez.
4. Kuyruk ödeme/kargo yanıtından sonra işlenir. Ayrıca her dakika
   GET /api/notifications/dispatch adresini Authorization: Bearer CRON_SECRET
   ile çağıracak zamanlayıcı kurun. Bu işlem yönetim panelinden bağımsızdır.
5. Sipariş ayrıntısındaki E-posta bildirimleri durumunu kontrol edin. Servisin
   kabulü alıcının gelen kutusuna teslim edildiği anlamına gelmez. Açılma veya
   teslim takibi bu sürümde eklenmedi.

## Güvenilirlik ve güvenlik

Kuyruk kalıcı sunucu verisidir; katalog yayını/geri yüklemesi bunu sıfırlamaz.
Bildirim anahtarı sipariş + olay + kargo sürümü için tektir. Aynı anahtar sağlayıcı
idempotency anahtarı olarak da kullanılır. İşçi lease/CAS ile sahiplenir; başarısız
gönderim en fazla beş kez, aynı anahtarla yeniden denenir. Otomatik tekrar ilk
denemeden itibaren 23 saatle sınırlıdır; sağlayıcının idempotency süresini aşan
belirsiz sonuçlar kontrol gerektirir. Yeniden gönderimden önce sağlayıcı kaydını
inceleyin. Kargo numarası değiştiğinde eski sürüm gönderilmez.

Kart bilgileri, kimlik numarası veya sağlayıcı anahtarı e-postaya eklenmez.
E-postalar işlem bildirimi niteliğindedir; analitik/çerez kabulüne bağlanmaz.
Pazarlama veya reklam gönderimi yapılmaz. Özel içerik yalnızca doğrulanmış
siparişin kayıtlı e-posta adresine gider; takip bağlantısı sadece geçerli HTTPS
bağlantısı varsa kullanılır. Firma bilgisi veya kargo bağlantısı uydurulmaz.

## Hostinger / MySQL

notification repository sözleşmesi sağlayıcıdan bağımsızdır.
database/mysql/008_order_notifications.sql şemayı hazırlar. Gelecekteki adaptör
aynı atomik kuyruk ekleme, lease/CAS, yetki ve tekrar kurallarını uygulamalıdır.
Canlı MySQL bağlantısı bu aşamada kurulmadı. Yerel SQLite yalnızca ilişkisel
demodur; servis anahtarı girilse bile gerçek e-posta gönderimi kapalı kalır.

## Tasarımı kontrol etme

Veri paneli → Siparişler → E-posta tasarımları. Gönderici, marka adı, logo altı
yazısı ve vurgu rengi ile üç e-postanın konu/başlık/açıklama/alt notu düzenlenir.
Masaüstü ve mobil görünüm anında yenilenir; Tasarımları kaydet ile saklanır.
Sipariş seçiliyken önizleme onun ürünlerini, miktarlarını, birim ve satır
fiyatlarını, KDV dahil brüt toplamını kullanır. Sipariş numarası ve hesaplanan
tutarlar tasarımdan çıkarılamaz. Genel ekranda açıkça örnek veriler gösterilir.

İndirmesiz panel yalnızca bu tarayıcıdaki tasarım taslağını tutar. Gerçek
uygulama ayarları sunucu veritabanında ayrı kaydedilir; katalog yayını bu
ayarları geri sarmaz. Gönderici adresini yazmak tek başına gönderim yetkisi
vermez; alan adı/sender doğrulaması ve sunucu servis yetkisi tamamlanmalıdır.

## Otomatik fatura e-postası

Siparişler → Sipariş numarası → Fatura → PDF fatura yükle. En fazla 4 MB PDF
kabul edilir. Bu alan yasal fatura oluşturmaz; sizin düzenlediğiniz faturayı
siparişe ekler. Ödeme doğrulanmış olmalıdır. Başarılı yükleme aynı işlem içinde
bir invoice_ready bildirimi oluşturur; dosya müşterinin siparişte kayıtlı
e-posta adresine gerçek PDF eki olarak gider. Ödeme onayı bekletilmez: fatura
sonradan yüklenirse ayrıca fatura e-postası gönderilir.

Aynı PDF'nin yeniden yüklenmesi ikinci bildirim oluşturmaz. Düzeltilmiş PDF
yeni sürüm olarak tutulur; önceki dosyalar yönetimde korunur. Henüz gönderilmemiş
eski fatura sürümü, güncel sürüm eklendiyse gönderilmez. İndirmesiz panel gerçek
fatura kabul etmez; yalnızca açıkça geçersiz örnek PDF ile akış denenebilir.

PDF'ler katalog/public klasörüne konmaz. Supabase özel order-invoices deposu;
yerel demo .data/invoices klasörü kullanılır. İndirme sunucuda yönetici yetkisiyle
kontrol edilir. Müşteri hesabı veya herkese açık belge bağlantısı gerekmez;
müşteri dosyayı e-posta eki olarak alır. PDF bütünlüğü SHA-256 ile doğrulanır.

020 göçü özel ayarları, fatura sürümlerini ve gönderim anlık görüntüsünü ekler.
İlk gönderimde adres/konu/HTML/metin/PDF kimliği sabitlenir; sonraki denemeler
aynı idempotency anahtarını ve aynı içeriği kullanır. Şablon değişiklikleri
başlatılmış bir gönderimin içeriğini değiştirmez. SQL 009 aynı sınırları
gelecekteki MySQL adaptörüne hazırlar; canlı bağlantı henüz kurulmadı.

## Hostinger kesin hedefi ve SMTP

Gönderim artık Resend'e zorunlu bağlı değildir. Hostinger paketindeki/ayrı
posta hizmetindeki gerçek SMTP bilgileriyle EMAIL_PROVIDER=smtp seçilebilir.
Bu değerler yalnızca sunucuda saklanır. Ayrıntılar deploy/hostinger/README.md
dosyasındadır. SMTP'nin belirsiz gönderim sonuçları otomatik tekrar yerine
kontrol durumuna alınır; sabit Message-ID kesin tek gönderim garantisi diye
sunulmaz. Supabase için 021_smtp_delivery.sql, gelecekteki MySQL adaptörü için
010_smtp_delivery.sql bu kuralları hazırlar. Şu anda gerçek SMTP bağlantısı yoktur.
