# Mağaza yönetimi

`/admin` adresinden giriş yapın. Canlı ortamda hesabınız Supabase Authentication üzerinden oluşturulur. Windows paketinde `demo@local.test` adresini ve ilk kurulumda kendiniz belirlediğiniz şifreyi kullanın. Komut satırıyla oluşturulan demoda rastgele şifre özel `.env.local` dosyasındadır.

## Yasal metinleri ve alt bilgi açıklamasını düzenleme

İndirmesiz panelde **Paneli göster → Yasal metinler** bölümünü açın. İlgili belgenin
**Metni düzenle** düğmesine basın; **Başlık / TR** ve **İçerik / TR** alanlarını
değiştirip **Değişiklikleri kaydet** kullanın. Gizlilik ve Çerez Politikası, Mesafeli Satış
Sözleşmesi, Ön Bilgilendirme Formu, İptal ve İade Koşulları ile Kullanıcı Sözleşmesi
aynı katalogdaki mevcut kayıtları kullanır; kopya sayfalar oluşturulmaz.

En alttaki © ile başlayan yasal açıklama için **Sayfa önizlemeleri** ekranında
**Düzenleme modu** açıkken açıklamaya tıklayın. Metni doğrudan veya sağdaki
**Seçili metni düzenle** alanından değiştirin. Bu alan otomatik taslak kaydı yapar;
değişiklik aynı tarayıcıdaki müşteri ön izlemesine yansır ve yenilemede korunur.
Bu yöntem açıklamanın tamamını değiştirir; metne sabit bir yıl yazarsanız sonraki
yıllarda da sizin yazdığınız metin gösterilir.

Sunucudaki kimlik doğrulamalı yönetimde aynı sözleşmeler **Yapılandırma** içindeki
sayfa kısayollarından veya **Sayfa içerikleri** listesinden düzenlenebilir.
Kaydetme taslağı günceller; müşteriye sunmak için **Yayın & sürümler → Taslağı
yayınla** kullanılır. İndirmesiz tarayıcı paneli canlı veritabanına otomatik kayıt
yapmaz. Sözleşme içerikleri düzenlenirken diğer diller ve ilişkisiz katalog
kayıtları korunur.

## Yeni motosiklet ekleme

1. **Motosiklet modelleri → Yeni kayıt**: Ducati, BMW veya Yamaha'yı seçin. Model adını, küçük harf ve tirelerden oluşan URL adını ve fotoğrafını girin. Örnek URL adı: `mt-25`.
2. Aynı formdaki **Nesiller ve yıl aralıkları → + Yıl aralığı ekle** düğmesine basın. Her satırda **Başlangıç yılı**, **Bitiş yılı** ve **Nesil açıklaması** girin. Örneğin R25 için kendi doğruladığınız yıllarla “1. nesil · ilk kasa”, “2. nesil · yeni kasa” ve “3. nesil” şeklinde üç ayrı satır ekleyebilirsiniz. Hazır yıl / nesil bilgisi varsayılmaz.
3. Kaydedince yeni veya değişen aralığın içindeki tüm üretim yılları otomatik oluşur. Aynı yıl iki farklı nesle atanamaz. Yalnızca açıklamayı veya fotoğrafı değiştirmeniz mevcut yıl kayıtlarını değiştirmez. Gelişmiş **Nesiller** ve **Üretim yılları** bölümleri, tek tek kayıt yönetimi için korunur.

Devam eden son nesil için **Bitiş yılı** yanındaki **Günümüz** kutusunu işaretleyin.
Örneğin başlangıcı 2025 olan aralık **2025–Günümüz** görünür. Bitiş yılı elle
girilmez; güncel Türkiye takvim yılı kullanılır ve yeni yılda yıl seçenekleri
güncellenir. Seçimi kaldırırsanız sabit bir bitiş yılı girebilirsiniz. Günümüz
yalnızca son nesilde kullanılabilir. Yeni yıllar mevcut ürün uyumluluklarına
kendiliğinden eklenmez; her ürün için doğrulayıp ayrıca eşleştirin. Eski sabit
aralıklar ve mevcut yıl kimlikleri korunur. Sunucuya kaydetme/yayınlama sırasında
güncel model-yıl kayıtları ilişkisel tablolara da yazılır; okuma görünümü bir yıl
değişiminde henüz yayımlanmamış yeni yılları aynı aralık bilgisinden türetir.

Mevcut Supabase kurulumu için `014_ongoing_generations.sql`; gelecekteki MySQL
kurulumu için `003_ongoing_generations.sql` hazırlanmıştır. Bağlantı kurulmaz veya
uzak veritabanında otomatik göç çalıştırılmaz.
4. Mevcut nesli birden fazla aralığa ayırdığınızda parça eşleştirmeleri önceki uyumluluk yıllarını koruyarak yeni nesillere bölünür. Uyumluluğu olan yılları aralıkların dışında bırakırsanız kayıt reddedilir; önce ilgili parça uyumluluğunu düzenleyin. Taslağı kaydettikten sonra **Yayın & sürümler → Taslağı yayınla** kullanın. Müşteri yıl seçerken ilgili nesil açıklamasını da görür.

Gelişmiş **Nesiller** ekranında tek kayıt değiştirirken mevcut yıllar veya uyumluluklar aralığın dışına düşecekse değişiklik reddedilir; önce bağlı kayıtları düzeltin. Model formundaki çoklu aralık düzenleyicisi ise bağlı yılları ve uyumlulukları birlikte günceller. Model silmek, bağlı nesil/yıl/uyumluluk kayıtlarını da siler; ürünleri silmez. Formdaki silme işlemi ikinci bir onay ister. Sipariş geçmişinde kullanılan ürünler silinemez; bunları yayından kaldırın.

## Ana sayfa: marka seçimi ve özel üretim

Video banner'ın altında **Markanı seç** alanı ve BMW, Ducati, Yamaha logoları yer alır. Her karta tıklamak ilgili markanın model sayfasını açar. Üç logo, motosikletler sayfasındaki logo kayıtlarıyla ortaktır; yüklediğiniz görseller, ölçek ve hizalama ayarları her iki yerde de kullanılır.

**Sayfa önizlemeleri → Ana sayfa** bölümünde **Düzenleme modu** açıkken başlığa tıklayıp yazıyı, logoya tıklayıp görseli ve ölçeğini düzenleyebilirsiniz. Normal gezinme için düzenleme modunu kapatın veya **Müşteri önizlemesi** açın.

Logoların altındaki **Ürününü bulamadın mı?** alanında **Talep oluştur** düğmesi mevcut **Parçanı ürettir** formunu açar. Başlık ve teklif çağrısı da önizlemede düzenlenebilir. Formun işleyişi değişmez.

Önceki fotoğraf galerisi ana sayfada gösterilmez; yüklediğiniz fotoğraf kayıtları tasarım verilerinde ve yedeklerde korunur. Banner yalnızca video kullanır; başlık ve düğme sol alttadır.

## Banner videosu yükleme

1. **Sayfa önizlemeleri → Ana sayfa** açıp **Düzenleme modu**nu etkinleştirin.
2. Banner arka planına tıklayın. Sağda **Banner videosu → Video yükle** alanından MP4 (H.264) veya WebM seçin; en fazla 50 MB.
3. Video bu tarayıcıya otomatik kaydolur. Sayfa yenilenince korunur; aynı tarayıcıdaki müşteri önizlemesinde de görünür. Sessiz ve döngüde oynar. Müşteri sağ alttaki küçük düğmeyle duraklatabilir. Hareket azaltma tercihi olan cihazlarda otomatik oynatılmaz.
4. **Taslağı indir** ile aldığınız JSON yedeği aktif videoyu da içerir. Başka tarayıcıda **Taslak yükle** videoyu geri getirir. Videolu yedekler için içe aktarma sınırı 100 MB'dır.
5. **Videoyu kaldır** düğmesi videoyu kaldırır; banner koyu ve boş kalır. Eski sürümlerdeki video dosyası korunur.

Gerçek sunucudaki yönetim panelinde **Fotoğraf düzeni → Ana sayfa banner videosu** kullanılır. Kaydetmek taslağı günceller; **Yayın & sürümler → Taslağı yayınla** ile müşterilere açılır. Canlı Supabase için 009'dan sonra **010_site_video.sql** kurulmalıdır. Sunucu/platform yükleme sınırı video boyutunu karşılamalıdır; uygulamanın üst sınırı 50 MB olsa da barındırma hizmeti daha düşük sınır uygulayabilir. Kurulumsuz önizlemedeki tarayıcı kaydı canlı dosya sunucusu yerine geçmez.

## Yeni ürün ekleme

Ürünler sipariş üzerine üretim içindir; stok sayısı girilmez. **Ürün fiyatı
(TRY, KDV dahil)** liste fiyatıdır. **İndirim oranı (%)** alanına 0–100 arasında
oran girin; indirimli fiyat ürün kartında, detayda, sepette ve sunucu sipariş
hesabında aynıdır. Vergi veya kargo ücreti üzerine eklenmez. Tüm ürünlerde kargo
ücretsizdir; ürünler 7–15 iş gününde kargoya verilir. Bu süre teslim tarihi değildir.

Yeni üründe **Parlak vernik** otomatik hazırlanır. **Mat vernik seçeneğini ekle**
kutusunu işaretlerseniz mat da sunulur. İşareti kaldırmak eski varyant/sipariş
kayıtlarını silmez; müşterinin yeni seçim yapmasını engeller. Stok alanları eski
kayıt uyumluluğu için veritabanında korunur ve satışa sınır koymaz.

Sepette **Ödeme yapın** ile üyelik/bilgi ekranına geçilir. **Son bir detay. →
Kişisel bilgilerinizi girin. → iyzico ile ödemeye geç** akışı kullanılır. Gerçek
iyzico ayarları etkinleşmediyse bilgi gönderilmez, sepet silinmez ve ödeme sonucu
üretilmez. İndirmesiz ön izleme kişisel bilgi ve ödeme göndermez. PayTR ayrıca
etkinleştirilirse düğme seçilen sağlayıcının adını gösterir.

Mevcut Supabase kurulumu için `013_product_commerce.sql` göçü gereklidir; göç
dosyası uygulama tarafından uzaktan çalıştırılmaz. Yerel demo şeması otomatik
güncellenir. Gelecekteki MySQL kurulumu için `database/mysql/002_product_commerce.sql`
şeması hazırlanmıştır. MySQL bağlantısı ve adaptörü henüz etkin değildir.

1. Gerekirse **Kategoriler** bölümünde kategori oluşturun.
2. **Ürünler → Yeni kayıt**: ad, URL, benzersiz SKU, kategori, malzeme, KDV dahil fiyat ve indirim oranını girin. Ağırlık ve medya bağlantıları isteğe bağlıdır. Bilmediğiniz teknik özellikleri uydurmayın.
3. TR, EN ve RU sekmelerinde metinleri doldurun. Açıklama ve sayfa metinleri düz metindir; HTML çalıştırılmaz.
4. Parlak vernik otomatik oluşturulur. Mat vernik de sunmak isterseniz ürün formundaki kutuyu işaretleyin; ayrı bir varyant veya stok kaydı girmeniz gerekmez.
5. **Ürün fotoğrafları**: aynı ürün için birden fazla kayıt ekleyebilirsiniz. Sıra 0 kapak görselidir. Yüklenen fotoğraflar herkese açık mağaza görselleridir; kişisel belge yüklemeyin.
6. Ürün formundaki **Uyumlu modeller ve yıllar → + Uyumlu model ekle** düğmesini kullanın. Her satırda marka, model ve başlangıç/bitiş yıllarını seçin. İsterseniz **Nesil / yıl grubu** seçerek kayıtlı yılları doldurun ve aralığı daraltın. Başka marka veya modeller için yeni satır ekleyin. Mevcut eşleştirmeler ürün düzenlenirken otomatik yüklenir; **Kaldır** yalnızca o uyumluluğu kaldırır. Ürün ve eşleştirmeleri birlikte kaydedilir. Yalnızca doğruladığınız uyumlulukları girin; aynı modelde çakışan yeni aralıklar reddedilir. Üretim yılları motosiklet kayıtlarından gelir; eksikse önce motosikleti düzenleyin. Ayrı **Uyumluluk** bölümü de kullanılabilir. Bir ürün için ayrı sayfa veya koleksiyon açmanız gerekmez.
7. Üründe **Yayında** seçeneğini açın. **Ana sayfada öne çıkar** seçeneği ana sayfada gösterir. **Örnek ürün** işaretini yalnızca bilgileriniz ve ürününüz gerçek satışa hazırsa kaldırın.
8. Müşteri görünümünden marka → model → yıl akışını izleyerek sonucu kontrol edin.

## Sipariş talepleri

**Sipariş talepleri** bölümünde iletişim, adres, ürünler, fiyatlar ve toplam görüntülenir. Durumu inceleme, onay, gönderim veya iptal olarak güncelleyebilirsiniz. Bunlar ödeme durumları değildir. Kartlı sipariş yalnızca doğrulanmış sağlayıcı sonucu ile ödenmiş sayılır. Sipariş üzerine üretimde stok ayırma yapılmaz. Kargo ücretsiz, fiyatlar KDV dahildir; kargoya verme süresi 7–15 iş günüdür. `Demo talebi` gerçek ticari sipariş değildir.

## Sayfalar ve ana sayfa

**Sayfa içerikleri** bölümünde `home` ana sayfa başlık/açıklamasını düzenler. `about`, `contact`, `faq`, `shipping`, `privacy`, `terms` diğer sayfaları yönetir. Sayfa anahtarlarını değiştirmeyin. İşletmenizin gerçek bilgilerini ve onaylanmış hukuki metinlerini girin. Hakkımızda metni KUZMIN’in karbon parça, motosiklet uyumluluğu ve özel üretim talebi yaklaşımını anlatır. Diğer işletme ve hukuki bilgiler henüz sağlanmadığı için ilgili sayfalarda yer tutucular bulunur.

Yönetici tüm işlemleri yapabilir. Editör ürün ve içerikleri düzenleyebilir; kayıt silemez veya müşteri siparişlerini göremez. Yeni kullanıcı/rol atamaları güvenli Supabase yönetiminden yapılır.

## Yapılandırma ekranı

`/admin/ayarlar` adresinde ana sayfa, iletişim ve diğer sayfa metinlerini düzenleyebilir; veritabanı sorgusu, Supabase ayarlarının tanımlı olup olmadığı, alan adı ve indeksleme durumunu görebilirsiniz. Bu sayfa da giriş gerektirir. Sunucu bağlantı bilgileri güvenli barındırma ortam ayarlarından yönetilir; anahtar değerleri yönetim ekranına gönderilmez.


## Tasarıma bakarak birlikte çalışma

Hızlı tarayıcı paneli ilk açılışta sitenin kendisini gösterir. Üstteki **Önizlenecek sayfa** listesinden sayfayı, ardından **Masaüstü / Tablet / Mobil** görünümünü seçin. Önizleme içinde normal bağlantılarla da gezebilirsiniz.

Bir yeri tarif etmek için **Bölüm seçme** kutusunu açıp başlığa, metne veya görsele tıklayın. Bölümün adı ve mevcut metni sağda görünür. **Ne değişsin?** alanına isteğinizi yazıp **Notu kopyala** düğmesiyle sohbete aktarabilirsiniz. Bu adım zorunlu değildir; gördüğünüz sayfayı ve değişikliği doğrudan da söyleyebilirsiniz.

Yeni tasarım yayınlandığında açık panel sürümü kontrol ederek yenilenir. Seçili sayfa, cihaz ve kaydedilmiş taslaklar korunur. Açık bir düzenleme formu varsa yenileme bekletilir. Gerekirse **Güncel tasarımı yükle** düğmesini kullanın. Ürün ve metin tablolarına dönmek için **Veri paneli** düğmesine basın.

Önizleme, tasarımı ve tarayıcıdaki katalog taslaklarını gösterir; gerçek sipariş göndermez veya canlı mağazanın veritabanını değiştirmez.

## Motosiklet seçiminden teklif alma

Marka → model → yıl seçildikten sonra **Ürününü bulamadın mı?** alanı ürün listesinin altında görünür. Hiç uyumlu ürün yoksa filtreler yerine teklif alanı sayfanın merkezinde gösterilir. **Talep oluştur** seçilen marka, model, yıl ve varsa kategori bilgisini taşır. Ürün detayından açılırsa ürün adı da açıklamaya eklenir. Formda bu bilgiler değiştirilebilir; talepler mevcut CRM akışına gider.

## Çerez tercihleri

Siteye her yeni girişte ve sayfa yenilendiğinde gerekli depolamayı ve isteğe bağlı istatistik/ısı haritasını açıklayan bildirim açılır. Önceki kabul yeni ziyaret için otomatik izin sayılmaz. **Kabul et**, **Reddet** veya **Tercihleri yönet** kullanılabilir. Analiz, o ziyaret için seçim yapılana kadar kapalıdır. Site içi sayfa geçişleri aynı ziyareti sürdürür. İzin geri çekme diğer açık sekmelerde de kaydı durdurur; başka sekmedeki kabul bu sekmeye kendiliğinden izin vermez. Son tercih kaydı senkronizasyon için en fazla 180 gün tutulabilir. Alt bilgideki **Çerez tercihleri** üzerinden izin değiştirilebilir. Analiz ayrıca yönetici ayarından açık olmalıdır; DNT/GPC kayıt yapılmasını engeller. Önizleme test kaydı hem bu izin hem ayrıca **Test kaydını başlat** seçimini gerektirir.

## Alt bilgi ve hukuki sayfalar

Alt bilgideki beş sözleşme/politika sayfasını **Sayfa önizlemeleri** veya **Sayfa içerikleri** bölümünden düzenleyin. `(Buraya … girin)` alanları firma bilgilerinize göre tamamlanır. Müşteri ve sipariş bilgileri kamuya açık metne yazılmaz; siparişe özel belgeye aittir. Alan listesi, hukuki kontrol sınırı ve kurulum ayrıntıları için [Hukuki metinler](HUKUKI-METINLER.md) belgesini kullanın.

## En çok satanlar vitrini

**Veri paneli → En çok satanlar** bölümünde en fazla 10 farklı ürün seçin. Seçili ürünleri yukarı/aşağı taşıyarak sıralayın, geçiş süresini 3–20 saniye arasında seçin ve **Vitrini kaydet** kullanın. 0 seçim alanı gizler; masaüstünde üç kart yan yana görünür. Dört veya daha fazla yayındaki üründe karusel otomatik ilerler. Fare üzerindeyken, klavye odağı içerideyken ve düzenleme modunda otomatik geçiş durur. Hareket azaltma tercihi ve sekmenin görünürlüğü de dikkate alınır. Mobilde kaydırılabilir. Bu alan sahibin seçtiği vitrindir; satış raporuna göre otomatik sıralama yapılmaz. Örnek ürünler DEMO etiketini taşır.

Düzenleme modunda vitrin fotoğrafına tıklayın: **Ölçek (%50–%200)**, yatay/dikey konum, açılıp kapanan **Hizalama kılavuzu** ve **Hepsini ortala** bulunur. Bu kadrajlar ürün detayındaki fotoğrafı değiştirmez. Vitrin görseli ayrıca değiştirilebilir. Yerel sunucudaki yönetim panelinde aynı seçim/kadraj ayarları vardır; normal yayın akışını kullanın.

Üç yeni blog yazısı, **Sayfa içerikleri** bölümünde başlığı/içeriğiyle düzenlenebilir. Blog listesi veya yazıdaki görsele tıklayarak görsel değiştirilebilir. Başlık ve meta açıklama, anlamsal ara başlıklar, ilgili yazı bağlantıları ve örnek/şematik görseller hazırlanmıştır. Diğer diller açılmadan önce makale çevirilerini tamamlayın.

Alt bilgi bağlantıları yatay destek ve hukuk satırları halinde düzenlenmiştir. Sağda gerçek ödeme logoları için ayrılmış alan vardır; logolar paylaşılmadan ödeme işareti gösterilmez.
