import type { DatabaseSync } from "node:sqlite";
import { defaultEmailDesign } from "@/lib/email-design";
// Private operational data; excluded from catalog publication, browser drafts and backups.
export const notificationSchema = `
CREATE TABLE IF NOT EXISTS order_notifications(
 id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN('order_confirmed','shipment_shared','invoice_ready')),version INTEGER NOT NULL,
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

const initialized = new WeakSet<DatabaseSync>();
export function ensureEmailSchema(db: DatabaseSync) {
  if (initialized.has(db)) return;
  db.exec(notificationSchema);
  const ddl = db
    .prepare("SELECT sql FROM sqlite_master WHERE name='order_notifications'")
    .get()!.sql as string;
  if (!ddl.includes("invoice_ready")) {
    db.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE");
    try {
      db.exec(
        "DROP TRIGGER IF EXISTS order_confirmation_notice; DROP TRIGGER IF EXISTS shipment_notice; DROP TRIGGER IF EXISTS invoice_notice",
      );
      db.exec(
        ddl
          .replace("order_notifications", "order_notifications_upgrade")
          .replace("'shipment_shared'", "'shipment_shared','invoice_ready'"),
      );
      db.exec(
        "INSERT INTO order_notifications_upgrade SELECT * FROM order_notifications; DROP TABLE order_notifications; ALTER TABLE order_notifications_upgrade RENAME TO order_notifications",
      );
      db.exec(notificationSchema);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    } finally {
      db.exec("PRAGMA foreign_keys=ON");
    }
  }
  if (
    !db
      .prepare("PRAGMA table_info(order_notifications)")
      .all()
      .some((c) => c.name === "email_payload")
  )
    db.exec("ALTER TABLE order_notifications ADD COLUMN email_payload TEXT");
  db.exec(`CREATE TABLE IF NOT EXISTS order_email_design(id TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 0,settings TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS order_invoices(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,version INTEGER NOT NULL,file_name TEXT NOT NULL,storage_key TEXT NOT NULL UNIQUE,size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 4194304),sha256 TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(order_id,version),UNIQUE(order_id,sha256));
  CREATE TRIGGER IF NOT EXISTS invoice_notice AFTER INSERT ON order_invoices
  WHEN EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND demo=0 AND payment_status='paid' AND status<>'cancelled')
  BEGIN INSERT OR IGNORE INTO order_notifications(id,order_id,kind,version,next_attempt_at,created_at) VALUES('invoice-'||NEW.id,NEW.order_id,'invoice_ready',NEW.version,NEW.created_at,NEW.created_at); END;`);
  db.prepare(
    "INSERT OR IGNORE INTO order_email_design(id,revision,settings) VALUES('site',0,?)",
  ).run(JSON.stringify(defaultEmailDesign));
  initialized.add(db);
}
