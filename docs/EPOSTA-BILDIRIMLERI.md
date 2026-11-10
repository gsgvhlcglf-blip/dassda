# Sipariş ve kargo e-postaları

Bu çalışma servis hesabı açmaz veya canlı e-posta göndermez. Gerekli alanlar
sağlanınca çalışan sunucu uygulaması için altyapıyı hazırlar.

## Kurulum

1. Supabase göçlerini 001–019 sırasıyla uygulayın. 019 özel bildirim kuyruğunu ve
   sipariş/ödeme işlemiyle aynı transaction içinde çalışan tetikleyicileri ekler.
2. Resend üzerinde size ait gönderici alan adını doğrulayın. Sunucuda
   EMAIL_PROVIDER=resend, RESEND_API_KEY, ORDER_EMAIL_FROM ayarlayın. İsteğe bağlı
   ORDER_EMAIL_REPLY_TO yanıt adresidir. Anahtarı tarayıcı paneline yazmayın.
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
