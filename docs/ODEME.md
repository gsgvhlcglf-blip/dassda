# PayTR ve iyzico ödeme altyapısı

İki sağlayıcı için sunucuda oluşturulan ödeme oturumu, sağlayıcı üzerinde kart girişi, imza/tutar doğrulaması, tekrar bildirim koruması, stok ayırma ve özel ödeme sonucu ekranı hazırlanmıştır. Başlangıçta ödeme kapalıdır. Gerçek sağlayıcı hesabı ve anahtarları olmadan tahsilat yapılmaz.

## Tarayıcı paneli

**Veri paneli → Ödeme altyapısı** bölümünden PayTR/iyzico ve planlanan test/canlı modunu seçebilirsiniz. Bu tercih yalnızca tarayıcıda saklanır. Kurulumsuz panelde anahtar, kart veya müşteri bilgisi girilmez; ödeme API'si çağrılmaz. Canlı ödeme açma işlemi giriş korumalı gerçek uygulamada yapılır.

## Canlı uygulamada kurulum

1. Supabase göçlerini 001–005'ten sonra `supabase/migrations/006_payments.sql` ile tamamlayın. Yerel SQLite uygulaması test tablolarını kendisi oluşturur; yerel adaptörde canlı tahsilat engellenir.
2. Sunucuda/Vercel ortam değişkenlerinde `.env.example` içindeki alanları doldurun. Gizli alanlara **NEXT_PUBLIC** öneki eklemeyin; tarayıcı paneline veya GitHub'a anahtar yazmayın.
3. `NEXT_PUBLIC_SITE_URL` gerçek HTTPS site kökeni olmalıdır (örn. kendi alan adınız). Giriş ve üyelik kurulumu, Supabase e-posta doğrulaması ve yasal/ticari sayfalar önceden tamamlanmalıdır.
4. `/admin → Ödeme altyapısı` bölümünde sağlayıcıyı ve önce Test modunu seçin. Ayarları kaydedip sunucuda eksik görünen alanları tamamlayın. İşlem açma anahtarı yalnızca gerekli yapılandırma mevcutsa kabul edilir. “Yapılandırma mevcut” anahtarların doğruluğunun sağlayıcı tarafından onaylandığı anlamına gelmez.
5. Gerçek sağlayıcı test hesabıyla başarılı/başarısız işlem ve bildirim dönüşünü deneyin. Sağlayıcı hesabı/anahtarları bu çalışma sırasında sunulmadığından gerçek PayTR/iyzico sandbox erişimi ve mağaza onayı henüz doğrulanmamıştır. Kod testleri taklit sağlayıcı yanıtları ve izole veritabanları kullanır.
6. Ticari ürünleri, fiyatları, kargo/vergilendirme koşullarını ve sağlayıcının canlı kullanım onayını doğruladıktan sonra gerçek yönetim panelinde Canlı modu seçip etkinleştirin. Demo ürünler canlı ödemeye kapalıdır.

### Sunucu değişkenleri

- `SUPABASE_SERVICE_ROLE_KEY`: ödeme tablolarını ve doğrulanmış bildirimleri sunucuda yönetmek için Supabase servis anahtarı. Yalnızca sunucuda kullanılır. Standart katalog yönetimi SSR anahtarı ve RLS ile çalışmaya devam eder.
- PayTR: `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT`. Test ve canlı isteği PayTR `test_mode` alanıyla ayrılır.
- iyzico test: `IYZICO_TEST_API_KEY`, `IYZICO_TEST_SECRET_KEY`.
- iyzico canlı: `IYZICO_LIVE_API_KEY`, `IYZICO_LIVE_SECRET_KEY`.
- `CRON_SECRET`: isteğe bağlı zamanlanmış stok temizleme uç noktasının Bearer anahtarı.

PayTR bildirim adresi: `https://kendi-alan-adiniz/api/payments/paytr/callback`. Bunu mağaza hesabındaki bildirim adresi olarak tanımlayın. Başarılı bildirim düz metin `OK` döndürür. Veritabanı/servis hatalarında yeniden denemeye izin verecek hata yanıtı verilir. Başarı/başarısızlık müşteri dönüş adresleri otomatik olarak oluşturulur ve ödeme durumunu değiştirmez.

iyzico dönüş adresi, ödeme oturumu oluşturulurken `https://kendi-alan-adiniz/api/payments/iyzico/callback?attempt=...` biçiminde gönderilir. Dönüşteki token, kaydedilen oturumla eşleştirilir; sonuç iyzico'dan yeniden alınır ve yanıt imzası doğrulanır. Test ve canlı için ayrı resmi API ve ödeme sayfası alan adları kullanılır.

Sağlayıcınızı değiştirseniz veya yeni ödeme başlatmayı kapatsanız bile mevcut oturumların bildirimleri işlenir. Bekleyen işlemler tamamlanmadan eski sağlayıcının anahtarlarını kaldırmayın. Dağıtım ağ politikasında PayTR için `www.paytr.com`, iyzico için `sandbox-api.iyzipay.com` / `api.iyzipay.com` erişimi ve sağlayıcıdan HTTPS bildirim alımı açık olmalıdır. Bu bulut çalışma ortamında gerçek ödeme anahtarı yapılandırılmamıştır.

## Alışveriş ve sonuç

Üyelik gerekir. Sipariş tutarı istemcinin gönderdiği fiyattan alınmaz: yayımlanmış ürün/varyantlardan sunucuda hesaplanır ve sipariş satırlarında saklanır. Aynı sipariş için ödeme başlatmayı tekrarlamak mevcut ödeme oturumunu döndürür; ikinci sağlayıcı başlatma isteği oluşturmaz. Bu sürüm ürün toplamını tahsil eder; ayrıca kargo bedeli, indirim, taksit vade farkı veya vergi hesaplama motoru eklenmemiştir. Yayımlanan ürün fiyatları ve müşteriyle paylaşılan teslimat koşulları tahsil edilecek bedelle uyumlu olmalıdır.

PayTR güvenli iframe'i; iyzico ise sağlayıcının barındırdığı ödeme sayfası kullanılır. PAN, CVV, son kullanma tarihi veya kart şifresi mağaza formuna/API'sine alınmaz. iyzico için alıcının ad/soyad, şehir, ülke ve kimlik/pasaport bilgisi gerekir. Kimlik numarası ödeme başlatma sırasında sağlayıcıya iletilir, mağaza veritabanında veya analitik olaylarında saklanmaz. Sağlayıcının ihtiyaç duyduğu alıcı IP'si güvenilen barındırma/proxy başlıklarından alınır; ödeme tablosunda tutulmaz. Gerçek KVKK/gizlilik metni işletmenin uygulamasına göre güncellenmelidir.

Sonuç sayfası, giriş yapmış müşterinin yalnızca kendi ödeme kaydını sorgular. `success=true` gibi URL parametreleri siparişi ödenmiş yapmaz. PayTR HMAC bildirimi; iyzico kayıtlı token, sunucu sorgusu, yanıt HMAC'i, sipariş/oturum, tutar, para birimi ve risk sonucu ile doğrulanır. Tekrarlanan bildirim stok veya sipariş işlemini yeniden uygulamaz. Ödenmiş sonuç, sonradan gelen başarısız bildirimle geri alınmaz.

Test işlemleri `test_paid` olarak etiketlenir; gerçek tahsilat veya canlı stok düşümü oluşturmaz. Canlı tutar/risk/para birimi uyuşmazlığı `review` olarak kaydedilir ve otomatik onay durur. Ödeme durumu müşteri hesabında ve yönetimde görünür; yönetimde ayrıca sağlayıcının sipariş/işlem referansı gösterilir. Doğrulanmamış kartlı sipariş onaylanamaz/gönderildi yapılamaz.

## Stok ve zaman aşımı

Canlı ödeme başlarken sipariş satırları veritabanı kilidi altında denetlenir ve 30 dakika stok ayrılır. Başarısız işlemde ayrılan stok tek kez geri bırakılır. Süresi dolan oturumlar yeni ödeme başlatma ve ödeme durumu sorgulama sırasında temizlenir. Düşük trafik dönemlerinde de periyodik temizlik için sunucunuzda zamanlanmış bir görevle `GET /api/payments/expire` çağırın; `Authorization: Bearer <CRON_SECRET>` gerekir. Anahtarsız uç nokta çalışmaz.

Süre dolduktan sonra gelen doğrulanmış canlı ödemede stok yeniden kontrol edilir. Yeterli stok varsa bir kez düşülür; stok yoksa para alındığı bilgisi korunur ve sipariş incelemeye ayrılır. Müşteriden yeniden ödeme istenmez. Yönetici tarafından beklerken iptal edilmiş siparişe ödeme gelmesi de inceleme gerektirir.

İade, kısmi iade, ters ibraz, para birimi dönüşümü, taksit kampanyaları ve sağlayıcı mutabakat raporları için otomatik API eklenmemiştir. Bu işlemler sağlayıcının yönetim panelinden yürütülür ve mağazanın sipariş/stoğu ticari karara göre güncellenir. İçerik yayını ve eski sürüme dönme ödeme ayarlarını, ödeme kayıtlarını veya mevcut stokları geri sarmaz.

## Teknik doğrulama ve kaynaklar

```sh
node --import tsx tests/payments.test.ts
npm run build
node scripts/test-payment-app.mjs
npm run panel:build
node scripts/test-payment-preview.mjs
```

Kapsam: imza/alan adı/tutar kontrolleri, token-sipariş eşleşmesi, özel RPC/RLS yetkileri, idempotent stok işlemleri, zaman aşımı/geriden gelen ödeme, başarısız imza reddi, müşteri izolasyonu, test/canlı ayrımı ve şeffaf görsel yükleme. Taklit yanıtlarla test edilmiştir; gerçek sağlayıcı kabul testi hesap bilgileriyle yapılmalıdır.

Resmi protokol referansları: [PayTR Postman koleksiyonu](https://github.com/paytr/paytr-postman), [PayTR resmi bildirim doğrulaması](https://github.com/paytr/magento2-payment/blob/master/Model/Api/Webhook.php), [iyzico Node SDK ve checkout örnekleri](https://github.com/iyzico/iyzipay-node). İmzalama ve doğrulama kaynakları incelendi; bu projeye ek ödeme SDK bağımlılığı eklenmedi.
