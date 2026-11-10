-- Prepared for the future MySQL adapter, not a configured live connection.
CREATE TABLE order_daily_counters (
  day DATE PRIMARY KEY,
  last_number BIGINT UNSIGNED NOT NULL,
  CHECK (last_number BETWEEN 1 AND 9007199254740991)
) ENGINE=InnoDB;
INSERT INTO schema_migrations(version) VALUES ('005_daily_order_references');
-- Adapter initialization must bootstrap each Istanbul day from existing order
-- counts and matching #DDMMYY sequence suffixes without renumbering old orders.
-- Creating an order uses one transaction: lock/upsert the day's counter, increment
-- it, construct #DDMMYY + number in application code, insert the order and items.
-- Counter increments roll back on failed creation. Cancellation never decrements it.
-- Keep the orders.reference unique constraint and provider merchant_ref independent.
