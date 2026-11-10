// Private operational data; excluded from catalog publication, browser drafts and backups.
export const notificationSchema = `
CREATE TABLE IF NOT EXISTS order_notifications(
 id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN('order_confirmed','shipment_shared')),version INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT,lease_until TEXT,first_attempt_at TEXT,next_attempt_at TEXT NOT NULL,
 sent_at TEXT,provider_id TEXT,error TEXT,created_at TEXT NOT NULL,
 UNIQUE(order_id,kind,version)
);
CREATE INDEX IF NOT EXISTS order_notifications_pending ON order_notifications(status,next_attempt_at);
CREATE TRIGGER IF NOT EXISTS order_confirmation_notice AFTER UPDATE OF payment_status ON orders
 WHEN NEW.payment_status='paid' AND OLD.payment_status<>'paid' AND NEW.demo=0
 BEGIN INSERT OR IGNORE INTO order_notifications(id,order_id,kind,version,next_attempt_at,created_at)
 VALUES('confirmation-'||NEW.id,NEW.id,'order_confirmed',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;
CREATE TRIGGER IF NOT EXISTS shipment_notice AFTER UPDATE OF fulfillment_version ON orders
 WHEN NEW.fulfillment_version<>OLD.fulfillment_version AND NEW.shipped_at IS NOT NULL AND NEW.tracking_number<>'' AND NEW.payment_status='paid' AND NEW.demo=0
 BEGIN INSERT OR IGNORE INTO order_notifications(id,order_id,kind,version,next_attempt_at,created_at)
 VALUES('shipment-'||NEW.id||'-'||NEW.fulfillment_version,NEW.id,'shipment_shared',NEW.fulfillment_version,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;
`;
