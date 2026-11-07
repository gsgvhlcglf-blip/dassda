# Mağaza yönetimi

`/admin` adresinden giriş yapın. Canlı ortamda hesabınız Supabase Authentication üzerinden oluşturulur. Windows paketinde `demo@local.test` adresini ve ilk kurulumda kendiniz belirlediğiniz şifreyi kullanın. Komut satırıyla oluşturulan demoda rastgele şifre özel `.env.local` dosyasındadır.

## Yeni motosiklet ekleme

1. **Motosiklet modelleri → Yeni kayıt**: Ducati, BMW veya Yamaha'yı seçin. Model adını, küçük harf ve tirelerden oluşan URL adını ve fotoğrafını girin. Örnek URL adı: `mt-25`.
2. Aynı formdaki **Nesiller ve yıl aralıkları → + Yıl aralığı ekle** düğmesine basın. Her satırda **Başlangıç yılı**, **Bitiş yılı** ve **Nesil açıklaması** girin. Örneğin R25 için kendi doğruladığınız yıllarla “1. nesil · ilk kasa”, “2. nesil · yeni kasa” ve “3. nesil” şeklinde üç ayrı satır ekleyebilirsiniz. Hazır yıl / nesil bilgisi varsayılmaz.
3. Kaydedince yeni veya değişen aralığın içindeki tüm üretim yılları otomatik oluşur. Aynı yıl iki farklı nesle atanamaz. Yalnızca açıklamayı veya fotoğrafı değiştirmeniz mevcut yıl kayıtlarını değiştirmez. Gelişmiş **Nesiller** ve **Üretim yılları** bölümleri, tek tek kayıt yönetimi için korunur.
4. Mevcut nesli birden fazla aralığa ayırdığınızda parça eşleştirmeleri önceki uyumluluk yıllarını koruyarak yeni nesillere bölünür. Uyumluluğu olan yılları aralıkların dışında bırakırsanız kayıt reddedilir; önce ilgili parça uyumluluğunu düzenleyin. Taslağı kaydettikten sonra **Yayın & sürümler → Taslağı yayınla** kullanın. Müşteri yıl seçerken ilgili nesil açıklamasını da görür.

Gelişmiş **Nesiller** ekranında tek kayıt değiştirirken mevcut yıllar veya uyumluluklar aralığın dışına düşecekse değişiklik reddedilir; önce bağlı kayıtları düzeltin. Model formundaki çoklu aralık düzenleyicisi ise bağlı yılları ve uyumlulukları birlikte günceller. Model silmek, bağlı nesil/yıl/uyumluluk kayıtlarını da siler; ürünleri silmez. Formdaki silme işlemi ikinci bir onay ister. Sipariş geçmişinde kullanılan ürünler silinemez; bunları yayından kaldırın.

## Ana sayfa fotoğrafları

Ana sayfada banner ve dört görselli fotoğraf düzeni bulunur. Geniş motosiklet kadrajları karbon doku ve parça detaylarıyla eşleşir; mobilde geniş görsellerin arasına iki detay yan yana yerleşir. Bölüm başlıkları ve koleksiyon numaraları gösterilmez.

1. **Sayfa önizlemeleri → Ana sayfa** açın ve **Düzenleme modu** seçili olsun.
2. Fotoğraf eklemek istediğiniz alana tıklayın. Örnek konsept fotoğrafların her birini kendi görselinizle değiştirebilirsiniz.
3. Sağdaki **Yeni fotoğraf seç** alanından JPEG, PNG veya WebP yükleyin (en fazla 5 MB). Değişiklik bu tarayıcıdaki taslağa otomatik kaydolur.
4. **Müşteri önizlemesi** ile sonucu kontrol edin. Aynı tarayıcıda açık müşteri sekmesi de güncellenir. Fotoğraf çerçeveyi doldurur; uzun ve dar alanlar için uygun kadrajlı fotoğraflar seçin.
5. Mevcut yayın akışında **Yayın & sürümler → Taslağı yayınla** kullanın; farklı cihazda görünmesi için yayın gerekir. Yedek tasarım ve fotoğraf kayıtlarını da içerir.

Önceki sekizli düzene yüklediğiniz görseller tasarım kaydınızda ve yedeğinizde korunur. Yeni dört alan bağımsızdır. Banner altında masaüstünde 72 px, görseller arasında 24 px boşluk vardır; mobilde bu boşluklar 36 ve 16 px olur. Banner başlığına tıklayarak metni düzenleyebilir, banner fotoğrafını da aynı yöntemle değiştirebilirsiniz.

## Banner videosu yükleme

1. **Sayfa önizlemeleri → Ana sayfa** açıp **Düzenleme modu**nu etkinleştirin.
2. Banner görseline tıklayın. Sağda **Banner videosu → Video yükle** alanından MP4 (H.264) veya WebM seçin; en fazla 50 MB.
3. Video bu tarayıcıya otomatik kaydolur. Sayfa yenilenince korunur; aynı tarayıcıdaki müşteri önizlemesinde de görünür. Sessiz ve döngüde oynar. Müşteri sağ alttaki küçük düğmeyle duraklatabilir. Hareket azaltma tercihi olan cihazlarda otomatik oynatılmaz.
4. **Taslağı indir** ile aldığınız JSON yedeği aktif videoyu da içerir. Başka tarayıcıda **Taslak yükle** videoyu geri getirir. Videolu yedekler için içe aktarma sınırı 100 MB'dır.
5. **Videoyu kaldır, fotoğrafı kullan** düğmesi banner fotoğrafına döner. Eski sürümlerdeki video dosyası korunur.

Gerçek sunucudaki yönetim panelinde **Fotoğraf düzeni → Ana sayfa banner videosu** kullanılır. Kaydetmek taslağı günceller; **Yayın & sürümler → Taslağı yayınla** ile müşterilere açılır. Canlı Supabase için 009'dan sonra **010_site_video.sql** kurulmalıdır. Sunucu/platform yükleme sınırı video boyutunu karşılamalıdır; uygulamanın üst sınırı 50 MB olsa da barındırma hizmeti daha düşük sınır uygulayabilir. Kurulumsuz önizlemedeki tarayıcı kaydı canlı dosya sunucusu yerine geçmez.

## Yeni ürün ekleme

1. Gerekirse **Kategoriler** bölümünde kategori oluşturun.
2. **Ürünler → Yeni kayıt**: ad, URL, benzersiz SKU, kategori, malzeme, görünen fiyat ve toplam stok girin. Ağırlık ve medya bağlantıları isteğe bağlıdır. Bilmediğiniz teknik özellikleri uydurmayın.
3. TR, EN ve RU sekmelerinde metinleri doldurun. Açıklama ve sayfa metinleri düz metindir; HTML çalıştırılmaz.
4. **Varyantlar & stok**: her yüzey için ayrı varyant, benzersiz SKU, gerçek satış fiyatı ve stok ekleyin. Sepette varyant fiyatı kullanılır; ürün kartındaki fiyatı buna uygun tutun. Varyant oluşturulmadan ürün sepete eklenemez.
5. **Ürün fotoğrafları**: aynı ürün için birden fazla kayıt ekleyebilirsiniz. Sıra 0 kapak görselidir. Yüklenen fotoğraflar herkese açık mağaza görselleridir; kişisel belge yüklemeyin.
6. Ürün formundaki **Uyumlu modeller ve yıllar → + Uyumlu model ekle** düğmesini kullanın. Her satırda marka, model ve başlangıç/bitiş yıllarını seçin. İsterseniz **Nesil / yıl grubu** seçerek kayıtlı yılları doldurun ve aralığı daraltın. Başka marka veya modeller için yeni satır ekleyin. Mevcut eşleştirmeler ürün düzenlenirken otomatik yüklenir; **Kaldır** yalnızca o uyumluluğu kaldırır. Ürün ve eşleştirmeleri birlikte kaydedilir. Yalnızca doğruladığınız uyumlulukları girin; aynı modelde çakışan yeni aralıklar reddedilir. Üretim yılları motosiklet kayıtlarından gelir; eksikse önce motosikleti düzenleyin. Ayrı **Uyumluluk** bölümü de kullanılabilir. Bir ürün için ayrı sayfa veya koleksiyon açmanız gerekmez.
7. Üründe **Yayında** seçeneğini açın. **Ana sayfada öne çıkar** seçeneği ana sayfada gösterir. **Örnek ürün** işaretini yalnızca bilgileriniz ve ürününüz gerçek satışa hazırsa kaldırın.
8. Müşteri görünümünden marka → model → yıl akışını izleyerek sonucu kontrol edin.

## Sipariş talepleri

**Sipariş talepleri** bölümünde iletişim, adres, ürünler, fiyatlar ve toplam görüntülenir. Durumu inceleme, onay, gönderim veya iptal olarak güncelleyebilirsiniz. Bunlar ödeme durumları değildir. Sistem kart ödemesi almaz, otomatik e-posta göndermez ve talep oluşturulduğunda stok ayırmaz. Gerçek sipariş onayından önce stok, vergi, teslimat ve ücretleri müşteriye bildirin. `Demo talebi` gerçek ticari sipariş değildir.

## Sayfalar ve ana sayfa

**Sayfa içerikleri** bölümünde `home` ana sayfa başlık/açıklamasını düzenler. `about`, `contact`, `faq`, `shipping`, `privacy`, `terms` diğer sayfaları yönetir. Sayfa anahtarlarını değiştirmeyin. İşletmenizin gerçek bilgilerini ve onaylanmış hukuki metinlerini girin. Site şu anda bu bilgilerin yerine açık yer tutucular gösterir.

Yönetici tüm işlemleri yapabilir. Editör ürün ve içerikleri düzenleyebilir; kayıt silemez veya müşteri siparişlerini göremez. Yeni kullanıcı/rol atamaları güvenli Supabase yönetiminden yapılır.

## Yapılandırma ekranı

`/admin/ayarlar` adresinde ana sayfa, iletişim ve diğer sayfa metinlerini düzenleyebilir; veritabanı sorgusu, Supabase ayarlarının tanımlı olup olmadığı, alan adı ve indeksleme durumunu görebilirsiniz. Bu sayfa da giriş gerektirir. Sunucu bağlantı bilgileri güvenli barındırma ortam ayarlarından yönetilir; anahtar değerleri yönetim ekranına gönderilmez.


## Tasarıma bakarak birlikte çalışma

Hızlı tarayıcı paneli ilk açılışta sitenin kendisini gösterir. Üstteki **Önizlenecek sayfa** listesinden sayfayı, ardından **Masaüstü / Tablet / Mobil** görünümünü seçin. Önizleme içinde normal bağlantılarla da gezebilirsiniz.

Bir yeri tarif etmek için **Bölüm seçme** kutusunu açıp başlığa, metne veya görsele tıklayın. Bölümün adı ve mevcut metni sağda görünür. **Ne değişsin?** alanına isteğinizi yazıp **Notu kopyala** düğmesiyle sohbete aktarabilirsiniz. Bu adım zorunlu değildir; gördüğünüz sayfayı ve değişikliği doğrudan da söyleyebilirsiniz.

Yeni tasarım yayınlandığında açık panel sürümü kontrol ederek yenilenir. Seçili sayfa, cihaz ve kaydedilmiş taslaklar korunur. Açık bir düzenleme formu varsa yenileme bekletilir. Gerekirse **Güncel tasarımı yükle** düğmesini kullanın. Ürün ve metin tablolarına dönmek için **Veri paneli** düğmesine basın.

Önizleme, tasarımı ve tarayıcıdaki katalog taslaklarını gösterir; gerçek sipariş göndermez veya canlı mağazanın veritabanını değiştirmez.
