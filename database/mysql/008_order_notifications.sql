-- Prepared schema for the future MySQL adapter, not a configured connection.
CREATE TABLE order_notifications(
 id VARCHAR(180) PRIMARY KEY,order_id CHAR(36) NOT NULL,
 kind ENUM('order_confirmed','shipment_shared') NOT NULL,version INT NOT NULL,
 status ENUM('pending','sending','sent','failed','review') NOT NULL DEFAULT 'pending',
 attempts INT NOT NULL DEFAULT 0,lease_token CHAR(36),lease_until DATETIME(3),first_attempt_at DATETIME(3),
 next_attempt_at DATETIME(3) NOT NULL,sent_at DATETIME(3),provider_id VARCHAR(200),error VARCHAR(100),created_at DATETIME(3) NOT NULL,
 CONSTRAINT notice_order FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
 UNIQUE KEY notice_event(order_id,kind,version),INDEX notice_pending(status,next_attempt_at)
) ENGINE=InnoDB;
-- Adapter must insert the unique notification in the SAME transaction as verified
-- live payment or tracking publication; demo/test payments never enqueue email.
-- Claim using FOR UPDATE SKIP LOCKED and lease CAS. Preserve provider idempotency
-- keys, capped retries and the 23-hour automatic retry window. No catalog restore.
INSERT INTO schema_migrations(version) VALUES ('008_order_notifications');
