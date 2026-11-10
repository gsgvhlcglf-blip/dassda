-- Prepared for the future MySQL adapter; this file does not configure a live connection.
-- Hash the 256-bit HttpOnly guest cookie on the server; never store the raw token.
ALTER TABLE orders MODIFY customer_id CHAR(36) NULL,
  ADD COLUMN guest_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD INDEX orders_guest (guest_key,created_at,id);
ALTER TABLE payment_attempts MODIFY customer_id CHAR(36) NULL;
-- Create order + items + daily reference in one transaction. Bind guest_key server-side.
-- Every status/payment read must join orders and verify guest_key; never authorize by reference/email.
INSERT INTO schema_migrations(version) VALUES ('006_guest_checkout');
