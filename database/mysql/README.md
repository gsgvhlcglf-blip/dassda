# MySQL başlangıç şeması

Bu dizin canlı bağlantı kurmaz. `001_core.sql`, gelecekteki Hostinger kurulumu
için hazırlanmıştır; gerçek MySQL motorunda entegrasyon testi henüz yapılmadı.
Mevcut örnek katalog veya müşteri bilgisi içermez. Yeni/verisiz MySQL 8.0.16+
veritabanı hedeflenir; mevcut veritabanına körlemesine çalıştırmayın.

Sunucu adaptörü, kimlik/medya depoları, yetkiler, atomik işlemler ve veri aktarımı
sonraki entegrasyon aşamasında tamamlanır. `DATA_PROVIDER=mysql` bugün açık hata
verir ve demo depoya geri dönmez.

Kapsam, tablo ilişkileri ve geçiş adımları: [Veri mimarisi](../../docs/VERI-MIMARISI.md).

`002_product_commerce.sql` ürünün indirim oranını ve isteğe bağlı mat verniği ekler.
Ürünler sipariş üzerine üretilir; stok kolonları eski kayıt uyumluluğu içindir.
Uyarlama sırasında sipariş/ödeme miktarı ürünün KDV dahil indirimli fiyatından
hesaplanmalı, ücretsiz kargo için ek tutar alınmamalı ve stok rezerve edilmemelidir.

`003_ongoing_generations.sql`, model nesillerindeki **Günümüz** seçimini saklar.
Sabit aralıklar değiştirilmez. Sunucu aralığı güncel Türkiye yılına göre çözer;
model-yıl satırları kaydetme/yayınlama sırasında kalıcılaşır. Ürün uyumlulukları
yeni yıllara otomatik genişletilmez.
