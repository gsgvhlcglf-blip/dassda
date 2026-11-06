# Özel üretim, ürün talepleri ve CRM

## Müşteri akışı

**Parçanı ürettir** sayfasında özel üretim teklifi ve yeni ürün talebi iki ayrı hizmettir. Formlar üyelik istemez. Giriş yapılmışsa başvuru doğrulanan hesapla ilişkilendirilir.

Mevcut marka → model → yıl → ürün akışı korunur. Ürün listesinin altında iki talep kartı, satışta hiç ürün olmasa da görünür. Motosiklet, yıl, seçili kategori ve kaynak sayfa forma aktarılır; müşteri değiştirebilir. Ürün detayında da iki karta erişilir. Motosiklet listesinden ürüne geçerken model/yıl bağlamı URL'de korunur.

Ürün talebine bir, özel üretime en fazla sekiz referans fotoğrafı eklenir. JPEG/PNG/WebP, dosya başına 5 MB ve toplam 20 MB sınırı vardır. E-posta veya telefondan en az biri gerekir; seçilen iletişim kanalının bilgisi de zorunludur. Orijinal parçayı sağlayamayan özel üretim başvuruları kabul edilir ve teknik inceleme etiketi alır.

Başarı mesajı ancak kayıt tamamlanınca referans numarası gösterir. Fiyat/üretim tarihi vaat edilmez; onay ve koşullar iletilmeden parça gönderilmemesi belirtilir.

## Yönetim

Gerçek uygulamada **/admin → Talepler & CRM** yalnızca yöneticiye açıktır. Editör ve müşteriler başvuruları veya fotoğrafları okuyamaz.

- **Başvurular:** kişi, referans, parça veya modelle arama; tür, dönem ve aşama filtreleri; takip tarihi ve geciken takipler.
- **Talep detayı:** iletişim, motosiklet/kategori, teknik tercihler, referans fotoğrafları ve kaynak sayfa.
- **Aşama ve takip:** her talep türünün kendi aşamaları vardır. İleri/geri geçişler açıklama, tarih ve yönetici kaydıyla tarihçeye yazılır.
- **Referans parça:** sahibi, müşteri onay kanıtı, gönderim koşulları, gelen kargo, teslim tarihi/fotoğrafları, hasar/yüzey, fiziksel inceleme ve iade bilgileri.
- **Teklifler:** elle belirlenen TRY tutarıyla ön/nihai teklif sürümleri. İletim ve müşteri onayı ayrı kaydedilir. Önceki sürümler değişmez. Tutarı toplam teklif bedeli olarak girin; adet, malzeme ve dahil olan koşulları açıklamada netleştirin.
- **Müşteriler:** e-posta veya telefonla gruplanan başvurular.
- **İş analitiği:** talep türleri, teknik inceleme, model/parça/aşama dağılımı, farklı iletişim kaydı sayısı. Son tekliflerin toplamı ciro/tahsilat değildir.

Teklif kaydetmek e-posta, SMS veya WhatsApp göndermez. **İletildi olarak kaydet** ve **Müşteri onayını kaydet**, gerçekten yapılan iletişimin kanal/tarih/kanıt kaydıdır. Otomatik haberleşme sağlayıcısı bağlı değildir. Üyelik, sepet ve PayTR/iyzico akışı korunur; özel üretim teklifinden otomatik tahsilat yapılmaz.

İstek metni fiyatlandırma bölümünün başlığında bittiği için otomatik maliyet/fiyat formülü varsayılmadı; teknik değerlendirme sonrasında elle hazırlanan sürümlü teklif akışı uygulandı.

## Koşul dokümanları

Mülkiyet, hasar/risk, iade ve kalıp kullanım hakları için boş, düzenlenebilir alanlar vardır. İşletmenizin hazırladığı/onayladığı metinleri ekleyin. Hazır hukuki koşul uydurulmamıştır. Boş veya onaysız metinler müşteriye gösterilmez. Kaydetmek yeni sürüm oluşturur; bu operasyonel dokümanlar katalog taslağının yayın düğmesinden bağımsızdır.

Müşterinin kabul ettiği metin ve sürüm başvuruya kopyalanır. Gönderim için dört doküman hazırlanmalı, müşteriye iletilmeli; onay kanıtı/tarihi ve gönderim koşulları kaydedilmelidir. Sonra **gönderime izin verildi** kutusu açılır. Bu kayıt olmadan parça bekleme/kargo/teslim/fiziksel inceleme aşamalarına geçilemez.

Takip değişiklikleri eski/yeni değerlerle geçmişe kaydedilir. Sonraki metin değişiklikleri önceki onayları değiştirmez. Onay geri alınsa bile eski kanıt tarihçede korunur.

## Sunucu kurulumu

1. 001–007'den sonra **supabase/migrations/008_work_requests.sql** dosyasını uygulayın.
2. Sunucuda `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` ve yalnızca sunucuya ait `SUPABASE_SERVICE_ROLE_KEY` bulunmalı. Servis anahtarını panel formuna, müşteri tarayıcısına veya GitHub'a koymayın.
3. Göç; korumalı talep, olay, dosya ve koşul sürümü tablolarını, **work-requests** adlı özel Storage bucket'ını oluşturur. Bucket'ı herkese açık yapmayın. Doğrudan misafir tablo/RPC yazımı kapalıdır; başvurular doğrulanan sunucu rotasından alınır.
4. Formları, yönetici rolünü ve dosya erişimini gerçek Supabase kurulumunda deneyin. Yapılandırma eksikse başarı taklidi yapılmaz; hizmetin açılmadığı gösterilir.

Sunucuda boyut/tür doğrulaması, honeypot, kaynak/iletişim bazlı veritabanı hız sınırı, gönderim anahtarıyla idempotency ve motosiklet ilişkisi doğrulaması uygulanır. Reverse proxy istemciden gelen sahte `X-Forwarded-For` başlığını geçirmemelidir; kaynak sınırı güvenilir proxy bilgisine dayanır, iletişim sınırı ayrıca uygulanır. Başarısız kayıtların yüklemeleri temizlenir. Yönetici düzenlemelerinde sürüm kontrolü sekmelerin birbirini ezmesini önler.

Supabase fotoğrafları yöneticiye kısa süreli imzalı bağlantıyla açılır. Yerelde dosyalar `public/` içinde değil **.data/request-files/** altında tutulur ve yönetici kontrolünden geçer; kayıtlar **.data/store.sqlite** içindedir. Yedekleme veritabanını ve özel dosyaları birlikte kapsamalıdır. Katalog JSON dışa aktarımı operasyonel CRM kayıtlarını içermez.

## Kurulumsuz tasarım paneli

Yeni sayfa **Önizlenecek sayfa → Parçanı ürettir**, CRM ise **Veri paneli → Talepler & CRM** ile açılır. CRM'de yalnızca `DEMO-` referanslı örnekler vardır; aşamalar, teklifler ve analizler denenebilir. Örnekler ayrı `.crm-demo.v1` tarayıcı alanında tutulur; katalog/fotoğraf/tasarım kayıtları korunur.

Tasarım önizlemesindeki müşteri formu gerçek talep göndermez, iletişim bilgilerini saklamaz ve sahte gerçek başvuru numarası üretmez. Özel dosya yükleme kimlik doğrulanan uygulamada çalışır. Örnekler canlı CRM'e müşteri olarak aktarılmaz.

## Kontroller

- `node --import tsx --test tests/requests.test.ts`: doğrulama, iş akışı, teklif/onay geçmişi, PostgreSQL göçü ve RLS.
- `node scripts/test-requests.mjs`: önizleme, bağlam aktarımı, boş stok, örnek CRM, mobil form ve kapalı gerçek gönderim.
- `node scripts/test-requests.mjs --app`: misafir kayıt, özel fotoğraflar, idempotency, admin aşama/teklif/onay/teslim alma ve eşzamanlı düzenleme koruması.
