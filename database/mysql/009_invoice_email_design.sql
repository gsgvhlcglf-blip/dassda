-- Prepared for the future MySQL adapter. No live connection is configured here.
ALTER TABLE order_notifications MODIFY kind ENUM('order_confirmed','shipment_shared','invoice_ready') NOT NULL,
 ADD COLUMN email_payload JSON NULL;
CREATE TABLE order_email_design(id VARCHAR(20) PRIMARY KEY,revision INT NOT NULL DEFAULT 0,settings JSON NOT NULL) ENGINE=InnoDB;
INSERT INTO order_email_design(id,settings) VALUES('site','{"brand":"KUZMIN","tagline":"CARBON MOTORCYCLE PARTS","senderEmail":"","replyTo":"","accent":"#a64a3c","templates":{"order_confirmed":{"subject":"Siparişiniz onaylandı · {siparis_no}","heading":"Siparişiniz onaylandı.","intro":"Ödemeniz başarıyla doğrulandı. Siparişinizin özeti aşağıda; üretim ve gönderim sürecinde sizi bilgilendireceğiz.","footer":"Sipariş numaranızı saklayın. Destek talebinizde bu numarayı belirtin.","button":""},"shipment_shared":{"subject":"Siparişiniz kargoya verildi · {siparis_no}","heading":"Siparişiniz yola çıktı.","intro":"Siparişiniz kargoya verildi. Takip numaranızla gönderinizi kontrol edebilirsiniz.","footer":"Takip hareketleri kargo firmasının sistemi güncellendikçe görünür.","button":"Kargomu takip et"},"invoice_ready":{"subject":"Faturanız hazır · {siparis_no}","heading":"Faturanız hazır.","intro":"Siparişinize ait faturanızı bu e-postaya PDF olarak ekledik.","footer":"Faturanızı ve sipariş numaranızı saklayabilirsiniz.","button":""}}}');
CREATE TABLE order_invoices(
 id CHAR(36) PRIMARY KEY,order_id CHAR(36) NOT NULL,version INT NOT NULL,
 file_name VARCHAR(140) NOT NULL,storage_key VARCHAR(80) NOT NULL UNIQUE,
 size INT NOT NULL,sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,created_at DATETIME(3) NOT NULL,
 CONSTRAINT invoice_order FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
 UNIQUE KEY invoice_version(order_id,version),UNIQUE KEY invoice_hash(order_id,sha256),
 CHECK(version>0),CHECK(size BETWEEN 1 AND 4194304)
) ENGINE=InnoDB;
-- Store PDF bytes outside the public web root, not as catalog media or a public URL.
-- Register metadata and the unique invoice_ready notice in the same paid-order transaction.
-- Lock the order, enforce expected invoice version and SHA dedupe, retain historical PDFs.
-- Freeze rendered recipient/sender/body and attachment hash under the notification lease;
-- retries reuse exactly the same content and provider idempotency key.
INSERT INTO schema_migrations(version) VALUES ('009_invoice_email_design');
