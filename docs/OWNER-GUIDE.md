# Mağaza yönetimi

`/admin` adresinden giriş yapın. Canlı ortamda hesabınız Supabase Authentication üzerinden oluşturulur. Windows paketinde `demo@local.test` adresini ve ilk kurulumda kendiniz belirlediğiniz şifreyi kullanın. Komut satırıyla oluşturulan demoda rastgele şifre özel `.env.local` dosyasındadır.

## Yeni motosiklet ekleme

1. **Motosiklet modelleri → Yeni kayıt**: Ducati, BMW veya Yamaha'yı seçin. Model adını, küçük harf ve tirelerden oluşan URL adını ve fotoğrafını girin. Örnek URL adı: `mt-25`.
2. **Nesiller → Yeni kayıt**: modeli seçin, nesil adını ve ilk/son üretim yıllarını girin. Gerçek teknik bilgilere göre tanımlayın.
3. **Üretim yılları → Yeni kayıt**: aynı modeli ve nesli seçerek her kullanılabilir yılı ekleyin. Sadece eklediğiniz yıllar müşteriye gösterilir.

Mevcut yıllar veya uyumluluk kayıtları nesil aralığının dışına düşecekse nesil değişikliği reddedilir. Önce bağlı kayıtları düzeltin. Model silmek, bağlı nesil/yıl/uyumluluk kayıtlarını da siler; ürünleri silmez. Formdaki silme işlemi ikinci bir onay ister. Sipariş geçmişinde kullanılan ürünler silinemez; bunları yayından kaldırın.

## Yeni ürün ekleme

1. Gerekirse **Kategoriler** bölümünde kategori oluşturun.
2. **Ürünler → Yeni kayıt**: ad, URL, benzersiz SKU, kategori, malzeme, görünen fiyat ve toplam stok girin. Ağırlık ve medya bağlantıları isteğe bağlıdır. Bilmediğiniz teknik özellikleri uydurmayın.
3. TR, EN ve RU sekmelerinde metinleri doldurun. Açıklama ve sayfa metinleri düz metindir; HTML çalıştırılmaz.
4. **Varyantlar & stok**: her yüzey için ayrı varyant, benzersiz SKU, gerçek satış fiyatı ve stok ekleyin. Sepette varyant fiyatı kullanılır; ürün kartındaki fiyatı buna uygun tutun. Varyant oluşturulmadan ürün sepete eklenemez.
5. **Ürün fotoğrafları**: aynı ürün için birden fazla kayıt ekleyebilirsiniz. Sıra 0 kapak görselidir. Yüklenen fotoğraflar herkese açık mağaza görselleridir; kişisel belge yüklemeyin.
6. **Uyumluluk**: ürün ve motosiklet modelini seçin. Nesli ve kapsanan yıl aralığını girin. Başka model/markalara da uyuyorsa yeni uyumluluk kayıtları ekleyin. Bir ürün için ayrı sayfa veya koleksiyon açmanız gerekmez.
7. Üründe **Mağazada göster** seçeneğini açın. **Ana sayfada öne çıkar** seçeneği ana sayfada gösterir. **Örnek ürün** işaretini yalnızca bilgileriniz ve ürününüz gerçek satışa hazırsa kaldırın.
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
