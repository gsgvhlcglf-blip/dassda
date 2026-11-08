# Veri mimarisi ve Hostinger / MySQL hazırlığı

Bu sürümde hosting kurulmadı, MySQL bağlantısı açılmadı ve canlı müşteri verisi
toplanmaya başlanmadı. Mevcut tasarım, URL’ler ve panel akışları korunur.

## Üç ayrı çalışma alanı

| Alan | Kayıt yeri | Kullanım |
| --- | --- | --- |
| İndirmesiz `docs/panel.html` / müşteri ön izlemesi | Aynı tarayıcının taslak deposu | Tasarım ve katalog denemesi; kalıcı işletme sistemi değildir |
| Yerel Next.js uygulaması | Sunucudaki `.data/store.sqlite` ve dosya klasörleri | Yeniden başlatmada korunan ilişkisel demo; gerçek sipariş/ödeme değildir |
| İleride canlı uygulama | Hostinger’daki MySQL ve sunucu dosya/nesne deposu | Kimlik, yetki, işlem ve yedekleme doğrulandıktan sonra işletme verisi |

Mevcut Supabase adaptörü ayrıca korunur; kullanılması zorunlu değildir.
Tarayıcı taslakları otomatik olarak bir sunucuya taşınmaz. `localStorage` sepet,
tasarım tercihleri ve açıkça etiketlenmiş ön izleme için kullanılabilir; hesap,
CRM, sipariş ve gerçek analitik için kalıcı kaynak kabul edilmez. Ön izlemedeki
örnek üye girişi bir kimlik doğrulama sistemi değildir; müşteri şifresi almaz.

## Uygulanan sınırlar

```text
Mevcut React ekranları ve formlar
        ↓ mevcut /api adresleri
Doğrulama + oturum + sunucu yetki kontrolleri
        ↓
src/lib/* veri hizmetleri / repository(...)
        ↓
src/server/persistence/contracts.ts
        ↓
Mevcut SQLite-demo/Supabase adaptörleri
Gelecek: aynı sözleşmeleri uygulayan MySQL adaptörleri
```

`src/server/persistence/index.ts` tek adaptör seçim noktasıdır. Sunucuya özel
modüller `server-only` ile korunur. SQL/SDK, cookie oturumu ve dosya depolama
uygulamaları `adapters/existing/` altında tutulur. Ekranlar veritabanı sürücüsü,
MySQL parolası veya servis anahtarı almaz.

| Sözleşme | Kapsam |
| --- | --- |
| `catalog` | Markalar, modeller, nesiller/yıllar, ürünler, varyantlar, görseller, uyumluluk, içerik |
| `workspace` | Katalog ve tasarım taslağı, sürüm çakışması, yayın/geri alma; stokların geri sarılmaması |
| `identity` | Müşteri ve personel oturumu, ayrı yetkiler, kayıt/giriş/çıkış, müşterinin kendi siparişleri |
| `orders` | Sunucuda hesaplanan fiyatlar ve sahiplik; sipariş isteği ve durum değişiklikleri |
| `requests` | Yeni ürün ve özel üretim talepleri, CRM aşamaları, belgeler, fotoğraflar, işlem geçmişi ve talep grafikleri |
| `analytics` | İzinli olaylar, saklama süresi, özetler, dönüşüm hunisi ve ısı haritası |
| `payments` | PayTR/iyzico ayarları, denemeler, süre aşımı ve doğrulanmış sağlayıcı sonucu |
| `media` | Katalog fotoğrafları ve banner videoları; özel talep dosyaları `requests` altında |

CRM ve grafikler ayrı kopya kayıtlar üretmez: `workInsights()` aynı talep
kayıtlarından sonuç döndürür. MySQL adaptörü bu sözleşmenin arkasında SQL ile
toplulaştırma yapabilir. SQLite/Supabase adaptöründeki mevcut talep raporlaması
şimdilik kayıtları sunucuda okuyarak hesaplar. Büyük katalog/listeler için MySQL
aşamasında filtre, arama, sayfalama ve raporlama sorguları veritabanında
çalıştırılmalı; bu mevcut arayüzün yeniden tasarlanmasını gerektirmez.

## Veri sağlayıcısı seçimi

`.env.example` sunucu ayarlarını gösterir. Gizli değerler tarayıcı paneline veya
Git deposuna yazılmaz.

- `DATA_PROVIDER=auto`: önceki davranışı korur; tam Supabase yapılandırması varsa
  Supabase, yoksa izin verilen yerel demo.
- `DATA_PROVIDER=sqlite-demo`: yalnızca yerel geliştirme veya açıkça izin verilen
  yerel demo. Üretimde varsayılan olarak kapalıdır; Vercel’de etkinleşmez.
- `DATA_PROVIDER=supabase`: URL ve genel anahtar birlikte gereklidir.
- `DATA_PROVIDER=mysql`: gelecekteki bağlantı aşaması için ayrılmıştır. Bu sürümde
  **`MYSQL_ADAPTER_NOT_CONFIGURED` ile işlemi durdurur**. MySQL seçilip arka planda
  SQLite’a veya tarayıcıya kayıt yapılmaz. Şu anda bu seçeneği etkinleştirmeyin.

Bir adaptörün yapılandırılması bağlantının test edildiği anlamına gelmez.
MySQL sürücüsü, bağlantı havuzu ve kimlik/medya uygulaması henüz eklenmedi.
Hazır SQL dosyası çalıştırılmadı; gerçek MySQL motorunda henüz doğrulanmadı.

## Hazırlanan MySQL şeması

`database/mysql/001_core.sql`, MySQL 8.0.16+ / InnoDB için başlangıç şemasıdır.
MariaDB ayrı uyumluluk kontrolü gerektirir. Para alanları `DECIMAL`, zamanlar UTC
`DATETIME(3)`, metinler `utf8mb4` kullanır. UUID metinleri ve mevcut katalog
kimlikleri korunabilecek şekilde ayrı kimlik türleri vardır.

Marka → model → nesil/yıl ilişkileri ve çoklu ürün uyumlulukları yabancı
anahtarlarla tanımlanmıştır. Neslin modele ait olması bileşik anahtarla korunur.
Yılın nesil aralığında olması, uyumluluk aralıkları, aşama geçişleri ve fiyat/stok
kuralları ayrıca sunucu doğrulamasından geçmelidir. Müşterinin yazdığı marka/model
alanları kataloğa zorunlu bağlanmaz; özel üretim herhangi bir marka için açılabilir.

`crm_contacts`, iki talep türünün ortak iletişim kaynağıdır. E-posta ve telefon
tek başına otomatik birleştirme anahtarı değildir; kişiler aynı iletişim bilgisini
paylaşabilir. `work_requests.input` ilk formun değişmez kopyasıdır; marka, model,
yıl, ölçü ve yöntem sütunları kayıt anında bundan üretilir. Aşama/operasyon bilgisi
ayrı güncellenir. Form bilgileri düzenlenecekse kopya ile sütunlar aynı işlemde
güncellenmeli ve geçmiş olayı eklenmelidir. Teklifler, dosyalar, sözleşme onay
metinleri ve geçmiş ayrı tablolardır; anlık görseller MySQL’e base64 olarak
doldurulmaz. Dosya meta verisi DB’de, dosya içeriği kontrollü bir depoda tutulur.

Katalog taslak/yayın anlık görüntülerindeki JSON, sürümleme içindir; yayındaki
ürün, stok, müşteri veya CRM kayıtlarının yerine geçmez. Taslak geri alımı
operasyonel stokları, müşteri verilerini veya ödeme geçmişini geri saramaz.

## Hostinger bağlantısı yapılacağı zaman

1. Seçilen paketin Next.js sunucusunu ve Node.js 24+ çalıştırabildiğini doğrulayın.
   Sadece PHP/MySQL sunan bir paketin Next.js’i çalıştırdığı varsayılmaz. Uygun
   Node.js barındırma veya VPS kullanılabilir; Vercel zorunlu değildir.
2. MySQL sürümünü doğrulayın, yedeklenmiş yeni bir veritabanında göçü test edin.
   Şema uygulayan kullanıcı ile uygulamanın sınırlı yetkili kullanıcısını ayırın.
3. `AdapterLoaders` sözleşmesine uyan MySQL modüllerini ekleyin. Merkezi seçim
   noktasında sağlayıcıyı bağlayın; `.env` ayarlarından sunucuya özel bağlantı havuzu
   oluşturun. Parametreli sorgular, uzak bağlantıda sertifika doğrulaması ve
   kaynağa göre bağlantı sınırı kullanın. Kurulumdan önce MySQL seçilirse mevcut
   hata davranışı korunmalıdır.
4. Supabase RPC işlevlerini aynı anlamı koruyan MySQL işlemlerine çevirin:
   sipariş ve stok kilitleri, ödeme idempotansı, tekil `submission_key`, talep +
   dosya + geçmiş için atomik commit, `revision` ile eşzamanlı düzenleme kontrolü.
   Kayıp yanıt sonrası talep fişi kurtarma ve belirsiz commit durumunda bağlı
   dosyaları silmeme kuralları korunmalıdır.
5. MySQL’de Supabase RLS yoktur. Yetki ve sahiplik kontrollerini her sunucu
   hizmetinde uygulayın; personel rolleri kullanıcı formundan alınamaz. Üyelikte
   şifre hashleme, e-posta doğrulama, kurtarma ve token-hash tabanlı iptal edilebilir
   HttpOnly/Secure oturumları uygulayın. Demo oturumlarını canlıya taşımayın.
   Sağlayıcıya özgü `/auth/callback` ve ödeme hazırlık kontrolleri de bu aşamada
   seçilen kimlik/veri altyapısına uyarlanır.
6. Mevcut taslakları export edin. Doğrulanmış katalog ve lisanslı görselleri
   aktarın; örnek ürünleri gerçek stok saymayın. Yayın öncesi sipariş/CRM/analitik
   test kayıtlarını açıkça ayırın. Müşteri verisini herkese açık bir JSON’a,
   indirmesiz panele veya kaynak ZIP’e aktarmayın.
7. Hesap izolasyonu, yönetici/editor yetkileri, model-yıl uyumluluğu, yeniden
   başlatma sonrası kalıcılık, yinelenen gönderimler, CRM ile grafiklerin aynı
   kayıtları göstermesi ve fotoğraf erişimini gerçek veritabanında test edin.
   Ardından günlük yedek, geri yükleme denemesi ve analitik saklama temizliğini
   etkinleştirin. Ödeme ancak gerçek sağlayıcı doğrulamasıyla başarılı sayılır.

Bu işlerin kapsamı sunucu adaptörleri, göç ve işletim ayarlarıdır; mevcut müşteri
ekranları ve veri giriş formları için yeniden yazım planlanmaz.
