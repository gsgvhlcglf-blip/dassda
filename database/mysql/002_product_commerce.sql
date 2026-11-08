-- Prepared MySQL 8 migration; no live connection is configured.
ALTER TABLE products
  ADD COLUMN discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN matte_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT discount_range CHECK (discount_percent BETWEEN 0 AND 100);

INSERT INTO schema_migrations(version) VALUES ('002_product_commerce');

-- The future adapter must use ROUND(price * (100-discount_percent)/100, 2)
-- as the authoritative unit price. Shipping is free and prices include VAT.
-- Legacy stock fields remain for old snapshots/orders, but are not a sale limit.
-- Gloss is default; a matte variant is sellable only when matte_enabled = TRUE.
-- No reservation/decrement is performed for these made-to-order products.
