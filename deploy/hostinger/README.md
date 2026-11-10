# Hostinger hedefi

Hosting sağlayıcısı kesin olarak Hostinger'dır. Paket henüz seçilmedi. Paket adı,
Node.js desteği, Node sürümü, kalıcı özel dosya alanı, zamanlayıcı, MySQL sürümü ve
SMTP hizmeti seçilen planın gerçek özelliklerinden doğrulanır. PHP/MySQL sunması
Next.js sunucusunu çalıştırdığı anlamına gelmez. Uygun yönetilen Node.js seçeneği
veya Node.js 24+ kurulabilen VPS gerekir; fiyat ve paket adı varsayılmadı.

Bu profil canlı kurulum yapmaz. MySQL şeması hazırlanmıştır; **MySQL adaptörü hâlâ
uygulanmamıştır**. DATA_PROVIDER=mysql şu anda MYSQL_ADAPTER_NOT_CONFIGURED ile
işlemleri durdurur. Üretim hedefinde SQLite-demo'ya geri düşülmez. Yapılandırılmamış üretim hedefi
mağaza ve API isteklerine 503 döndürür; demo mağazayı canlı gibi sunmaz. Supabase mevcut
alternatif adaptör olarak korunur; Hostinger hedefi Supabase/Vercel gerektirmez.

## Node.js üretim derlemesi

Derlemeyi hedef Linux ortamında yapın; Windows native modüllerini Linux'a taşımayın.

    npm ci
    npm run hostinger:build
    npm run hostinger:start

Build, Next.js standalone çıktısını artifacts/hostinger içine gerekli Node modülleri,
.next/static ve public dosyalarıyla hazırlar. .env dosyaları, yerel veritabanı,
yüklenen müşteri dosyaları ve tarayıcı önizlemesi uygulama paketine girmez.
Paket tek başına node server.js ile de çalışır. Alan adı/PORT/çalıştırma komutu
seçilen Hostinger panelinin kurallarına göre ayarlanır. hPanel'e .env örneği veya
kaynak ZIP koymak tek başına sitenin yayımlanması değildir.

Hostinger start betiği NODE_ENV=production ve DEPLOYMENT_TARGET=hostinger ayarlar.
VPS'de reverse proxy arkasında HOSTINGER_BIND_HOST=127.0.0.1; yönetilen Node
servisinde sağlayıcının istediği bind adresi kullanılır. HTTPS ve güvenilir
X-Forwarded-For/X-Forwarded-Proto başlıkları ödeme ve oturumlar için gereklidir.
Statik Next dosyaları sürümlü ve uzun süreli önbelleklidir; özel sipariş/fatura,
admin ve ödeme yanıtları genel CDN/proxy önbelleğine alınmamalıdır.

## Kalıcı veriler

.env.example içindeki boş alanlar gerçek sunucu ortamına girilir. PRIVATE_STORAGE_ROOT
mutlak ve herkese kapalı, sürüm klasöründen bağımsız bir yol olmalıdır. Özel PDF ve
CRM dosyaları bu kökün altında tutulur. Yeni bir kod sürümü yüklemek bu dizini
silmemelidir. Mevcut Supabase adaptörü özel bucket'larını kullanmaya devam eder.
MySQL adaptörü ekleneceği zaman aynı repository sözleşmelerini, işlem kilitlerini,
sahiplik/rol kontrollerini ve özel dosya kökünü kullanmalıdır. Veritabanı ve dosya
alanı birlikte yedeklenip geri yükleme doğrulanır; tarayıcı taslağı canlı veri değildir.

## Satış e-postası

Bir SMTP bağlantısı eklendi. EMAIL_PROVIDER=smtp ve satın alınan posta hizmetinin
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD değerleri sunucuda ayarlanır.
465 için doğrudan TLS; 587 için zorunlu STARTTLS kullanılır. Sertifika doğrulaması
kapatılmaz. Gönderici satış adresi panelde Siparişler → E-posta tasarımları bölümüne
yazılır; posta hesabının bu adresi kullanma yetkisi doğrulanır. Paket içindeki SMTP
ücret/limit/destek koşulları varsayılmadı. Resend isteğe bağlı kalır.

SMTP'nin API idempotency garantisi yoktur. Sabit Message-ID kullanılır; sunucunun
kabul edip etmediği belirsiz bir bağlantı kesintisinde bildirim kontrol durumuna
alınır ve körlemesine tekrar gönderilmez. Yarıda kalan SMTP işçisi için de aynı
kural uygulanır. Açık geçici SMTP retleri sınırlı yeniden denenir. Panelde servis
kabulü gösterilir; gelen kutusuna teslim/alıcı okuma teyidi uydurulmaz.

Hostinger üzerinde sunucuya cron/zamanlayıcı erişimi varsa her dakika, HTTPS
/api/notifications/dispatch adresi Authorization: Bearer CRON_SECRET ile çağrılır.
Ödeme süresi temizliği /api/payments/expire için aynı şekilde planlanır. Ödeme
bildirimleri ayrıca olaydan sonra kuyruğu işler. Zamanlayıcı desteği paket seçilince
netleşir; sadece yönetici tarayıcısının açık olmasına bağlı iş akışı kurulmaz.

## Tamamlanacak canlı entegrasyon

MySQL adaptörü ve gerçek motor göç/işlem testleri, Hostinger paket/proje/alan adı,
HTTPS, personel oturumu, özel dosya kalıcılığı, SMTP yetkisi, ödeme mağaza anahtarları
ve gerçek sağlayıcı callback testi hâlâ kurulum aşamasına aittir. Bu dosyalar bu
bağlantıların kurulmuş veya dış servislerin doğrulanmış olduğunu iddia etmez.
