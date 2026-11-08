# Hukuki sayfalar ve doldurulacak bilgiler

Alt bilgide Sık Sorulan Sorular ve Kargo Takip ile şu beş belge bulunur:

| Menü | Adres | İçerik anahtarı |
| --- | --- | --- |
| Gizlilik ve Çerez Politikası | `/gizlilik` | `privacy` |
| Mesafeli Satış Sözleşmesi | `/mesafeli-satis-sozlesmesi` | `distance-sales` |
| Ön Bilgilendirme Formu | `/on-bilgilendirme-formu` | `pre-information` |
| İptal ve İade Koşulları | `/iptal-iade-kosullari` | `shipping` |
| Kullanıcı Sözleşmesi / Şartlar ve Koşullar | `/kosullar` | `terms` |

Eski `/teslimat-iade` adresi aynı iade içeriğini açar. Önceki iletişim çağrıları ve herkese açık Yönetim bağlantısı alt bilgiden kaldırılmıştır.

## Panelden düzenleme

**Sayfa önizlemeleri** listesinden ilgili belgeyi seçin. Düzenleme modunda başlığa veya metne tıklayıp sağdaki alanı kullanın. **Sayfa içerikleri** bölümündeki ilgili kayıt da düzenlenebilir. Anahtarları değiştirmeyin. Canlı yönetim panelinde taslak değişiklikleri normal **Yayın & sürümler** akışından yayımlanır. Her belgenin içeriği 12.000 karakter sınırının içindedir.

`(Buraya … girin)` alanları tamamlanmalıdır. Şirket unvanı, adres, vergi/MERSİS/sicil, destek ve KVKK başvuru kanalı, iade adresi, kargo ve iade kodu, fiilen kullanılacak ödeme sağlayıcısı, saklama süreleri, hizmet sağlayıcılar, varsa yurt dışı aktarımı ve hukuki dayanağı, yürürlük tarihi/sürümü gereklidir. Bilinmeyen bir şirket, adres veya sağlayıcı üretilmemiştir.

Alıcı adı, müşteri adresi, sipariş numarası, ürün/tutar ve işlem onayı alanlarına **genel kamuya açık sayfada gerçek müşteri bilgisi yazmayın**. Bunlar her müşteriye özel sözleşme/ön bilgilendirme kopyasında doldurulmalıdır. Sayfalar genel metin şablonlarıdır; bu değişiklik siparişe özel belge üretme, sürümüne bağlı müşteri teyidi saklama veya sözleşme kopyası e-postası gönderme sistemi kurmaz. Sayfayı ziyaret etmek onay değildir.

Türkçe etkin dildir. İngilizce/Rusça başlıklar hazırlanmıştır; belge gövdesi Türkçe esas metne düşer. Diğer diller açılmadan önce uygun hukuki çeviriler girilmelidir.

## İçerik yaklaşımı ve kontrol sınırı

Metinler 6502 sayılı Kanun, Mesafeli Sözleşmeler Yönetmeliği, 6698 sayılı Kanun, elektronik ticaret ve ilgili tüketici hukuku çerçevesinde hazırlanan düzenlenebilir taslaklardır. Cayma, ayıplı mal/hizmet ve gerçekten kişiye özel üretim birbirinden ayrılır. Her karbon ürünün veya her hazır model/yıl varyantının otomatik olarak cayma istisnası olduğu iddia edilmez. Laminasyon hizmetinde erken ifa/istisna için ayrıca bilgilendirme ve gereken onay öngörülür. Yıllık hakem heyeti sınırları gibi değişken rakamlar sabitlenmemiştir.

Bu ortamda resmî mevzuat kaynaklarına erişim ağ politikası tarafından 403 ile engellendi; **güncel konsolide düzenlemenin bu oturumda doğrulandığı iddia edilmez**. Canlı kullanım öncesinde süreler, güncel değişiklikler, somut ürün/hizmet koşulları ve doldurulan firma bilgileri doğrulanmalıdır. Başvuru kaynakları:

- [6502 sayılı Kanun](https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6502.pdf)
- [6698 sayılı Kanun](https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6698.pdf)
- [Ticaret Bakanlığı tüketici mevzuatı](https://ticaret.gov.tr/tuketici/tuketici-mevzuati)
- [Mevzuat Bilgi Sistemi](https://www.mevzuat.gov.tr/)
- [Kişisel Verileri Koruma Kurumu](https://www.kvkk.gov.tr/)

Resmî kaynak alan adları için ağ erişim taslağı kaydedilmiştir. Taslak, ortam ayarlarında gözden geçirilip kaydedilerek ortam yayımlandığında uygulanabilir; kayıt tek başına erişimi açmaz. Bu, web sitesinin yayın akışından ayrı ortam yapılandırmasıdır.

Gizlilik metni fiili sistemi anlatır: gerekli sepet/oturum/tercih depolaması, her yeni ziyarette tekrar gösterilen çerez bildirimi, senkronizasyon için son tercih kaydı, o ziyarete özgü izinle ve yönetici ayarıyla açılan site içi analiz, DNT/GPC, form içeriklerinin analitiğe alınmaması. Google Analytics veya reklam pikselinin kurulu olduğu söylenmez. Sonradan araç/sağlayıcı eklendiğinde politika ve izin akışı da güncellenmelidir.

## Veritabanı ve mevcut taslaklar

- Başlangıç içeriği: `src/content/legal-pages.json` / `src/lib/legal-content.ts`.
- Tarayıcıdaki mevcut taslaklara yalnızca talep edilen metinler bir kez uygulanır. İki yeni sayfa açık `createIfMissing` güncellemeleriyle oluşturulur; ürünler, fotoğraflar ve diğer kayıtlar korunur. Uygulanmış güncelleme yeniden çalışıp sahibin sonraki düzenlemesini ezmez.
- Yerel SQLite, kayıtlı sürümle içerik ve varsa mevcut yönetim taslağını bir kez günceller; daha sonraki açılışlarda metinleri yeniden yazmaz.
- Supabase için 010'dan sonra `011_legal_pages.sql` uygulanır. Göç yalnızca bu beş belgenin Türkçe alanlarını ve gerekirse eksik belge kayıtlarını günceller; mevcut özel taslak içeriğini de aynı beş alan için yeniler. Diğer diller, stoklar, tasarım, fotoğraflar ve geçmiş sürümler korunur. Göç sistemi dışında gelişigüzel yeniden çalıştırmayın; hukuki metinleri panelden düzenleyin.
