-- Prepared for the future MySQL adapter; this file does not configure a connection.
ALTER TABLE orders
  ADD COLUMN tracking_number VARCHAR(80) NOT NULL DEFAULT '',
  ADD COLUMN shipping_carrier VARCHAR(120) NOT NULL DEFAULT '',
  ADD COLUMN tracking_url VARCHAR(2000) NOT NULL DEFAULT '',
  ADD COLUMN shipped_at DATETIME(3) NULL,
  ADD COLUMN fulfillment_version INT UNSIGNED NOT NULL DEFAULT 0;
INSERT INTO schema_migrations(version) VALUES ('004_order_tracking');
-- In one transaction: SELECT ... FOR UPDATE, verify staff, payment and version,
-- then update the shipment fields and increment fulfillment_version.
