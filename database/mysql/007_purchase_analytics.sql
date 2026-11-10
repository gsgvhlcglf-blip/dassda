-- Future MySQL adapter: accept checkout_start only at canonical /odeme, depth/x/y NULL,
-- referrer_host empty, with explicit current-visit analytics consent. No form values.
-- Calculate ordered product view -> successful cart add -> checkout by anonymous session/device.
-- Report paid counts/totals independently from orders, excluding demo and test_paid.
-- Never join the anonymous session identifier to customer details.
-- 001_core.sql has one unnamed analytics_events CHECK; MySQL names it analytics_events_chk_1.
-- For a previously customized schema, inspect the existing constraint name before applying.
ALTER TABLE analytics_events DROP CHECK analytics_events_chk_1,
 ADD CONSTRAINT analytics_event_kind CHECK (kind IN ('pageview','click','scroll','cart_add','checkout_start')),
 ADD CONSTRAINT analytics_checkout_step CHECK (
  (kind='checkout_start')=(path='/odeme') AND
  (kind<>'checkout_start' OR (x IS NULL AND y IS NULL AND depth IS NULL AND referrer_host=''))
 );
INSERT INTO schema_migrations(version) VALUES ('007_purchase_analytics');
