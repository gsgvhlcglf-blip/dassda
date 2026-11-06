# Özel üretim, ürün talepleri ve CRM

## Müşteri akışı

**Parçanı ürettir** sayfasında tek, kısa bir başvuru formu vardır. Müşteri marka, model ve yılı yazar; katalog listelerinden seçim yapmaz. Her marka/model kabul edilir. Özel üretim veya ürün talebi türü gelinen bağlantıdan belirlenir; müşteriye ayrıca tercih sorulmaz. Üyelik gerekmez; giriş yapılmışsa başvuru doğrulanan hesapla ilişkilendirilir.

Mağazanın marka → model → yıl → ürün akışı korunur. Talep kartları stok boşken de görünür. Motosiklet sayfasından gelinirse marka/model/yıl metin alanlarına önceden yazılır; müşteri serbestçe değiştirebilir. Kategori ve kaynak sayfa arka planda korunur; ekstra alan olarak sorulmaz. Ürün detayında da başvuru bağlantıları vardır.

Marka/model/yılın hemen altında iki görsel karttan **Forged Carbon / Twill Carbon**, ardından görselsiz iki seçenekten **Laminasyon — Mevcut parça üzerine kaplama / İnfüzyon — Kalıptan yeni parça üretimi** seçilir. Her grupta bir seçim zorunludur ve tercihler CRM talep detayına kaydolur. Karbon kartlarının görselleri temsili özgün çizimlerdir; gerçek ürün fotoğrafı veya üretim sonucu vaadi değildir. Düzenleme modunda görsele tıklayıp kendi fotoğrafınızı yükleyebilirsiniz. Görsel değişiklikleri mevcut tasarım kaydı ve JSON yedeğinde korunur.

Diğer zorunlu alanlar: marka, model, yıl, **Parça uzunluğu (cm)** ve **Parça genişliği (cm)**, tek açıklama, **en az 3 fotoğraf**, isim, ayrı alanlarda **Cep telefonu** ve **E-posta**. İletişim alanlarının ikisi de zorunludur; tarayıcı ve sunucu kontrol eder. En fazla 8 fotoğraf; JPEG/PNG/WebP, dosya başına 5 MB ve toplam 20 MB. Fotoğraflar birkaç seferde eklenebilir ve tek tek kaldırılabilir. Üç fotoğraf tamamlanmadan hem tarayıcı hem sunucu gönderimi reddeder. Yüzey, adet, nesil ve orijinal parça durumu sonradan görüşülür. Eski kayıtlar ve eksik bırakılmış eski bilgiler korunur; yeni üretim yöntemi belirtilmemiş olarak görünür.

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

İlk kısa form yalnızca talep için iletişim izni ister; ticari koşullar müşteriye sonradan iletilir. Gönderim için dört doküman hazırlanmalı, müşteriye iletilmeli; onay kanıtı/tarihi ve gönderim koşulları kaydedilmelidir. Sonra **gönderime izin verildi** kutusu açılır. Bu kayıt olmadan parça bekleme/kargo/teslim/fiziksel inceleme aşamalarına geçilemez. Eski başvurulardaki metin/sürüm/onay kayıtları korunur.

Takip değişiklikleri eski/yeni değerlerle geçmişe kaydedilir. Sonraki metin değişiklikleri önceki onayları değiştirmez. Onay geri alınsa bile eski kanıt tarihçede korunur.

## Sunucu kurulumu

1. 001–007'den sonra **008_work_requests.sql**, ardından **009_simple_work_requests.sql** dosyalarını uygulayın. 009, talep markasını/modelini katalogdan bağımsız hale getirir; ölçü sütunlarını ve üç fotoğraf kuralını ekler. Eski başvurular silinmez, bilinmeyen ölçüler uydurulmaz.
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
