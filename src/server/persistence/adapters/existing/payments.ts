import "server-only";
import { privileged } from "./privileged";
import { randomUUID } from "node:crypto";
import { isLive, localDB } from "@/lib/database";
import { supabase } from "@/lib/supabase";
import { minorUnits } from "@/lib/payments/protocol";
import type {
  PaymentAttempt,
  PaymentSettings,
  PaymentOrder,
} from "@/lib/payments/types";
function paymentDB() {
  const db = localDB();
  db.exec(
    `CREATE TABLE IF NOT EXISTS payment_settings(id TEXT PRIMARY KEY,provider TEXT NOT NULL DEFAULT 'none',mode TEXT NOT NULL DEFAULT 'test',enabled INTEGER NOT NULL DEFAULT 0);INSERT OR IGNORE INTO payment_settings(id) VALUES('site');CREATE TABLE IF NOT EXISTS payment_attempts(id TEXT PRIMARY KEY,order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),customer_id TEXT REFERENCES customers(id),provider TEXT NOT NULL,mode TEXT NOT NULL,state TEXT NOT NULL,amount_minor INTEGER NOT NULL,currency TEXT NOT NULL,merchant_ref TEXT NOT NULL UNIQUE,token TEXT UNIQUE,checkout_url TEXT,provider_payment_id TEXT,reserved INTEGER NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,error_code TEXT);CREATE TABLE IF NOT EXISTS payment_events(id TEXT PRIMARY KEY,attempt_id TEXT NOT NULL REFERENCES payment_attempts(id),kind TEXT NOT NULL,created_at TEXT NOT NULL);`,
  );
  // SQLite cannot drop NOT NULL in place. Preserve every legacy attempt and event.
  const attemptColumns = db
    .prepare("PRAGMA table_info(payment_attempts)")
    .all();
  if (attemptColumns.some((c) => c.name === "customer_id" && c.notnull)) {
    db.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE");
    try {
      const definition = db
        .prepare("SELECT sql FROM sqlite_master WHERE name='payment_attempts'")
        .get()!.sql as string;
      db.exec(
        definition
          .replace("payment_attempts", "payment_attempts_guest_migration")
          .replace(/customer_id TEXT NOT NULL/i, "customer_id TEXT"),
      );
      db.exec(
        "INSERT INTO payment_attempts_guest_migration SELECT * FROM payment_attempts; DROP TABLE payment_attempts; ALTER TABLE payment_attempts_guest_migration RENAME TO payment_attempts; COMMIT",
      );
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    } finally {
      db.exec("PRAGMA foreign_keys=ON");
    }
  }
  const columns = db.prepare("PRAGMA table_info(orders)").all() as {
    name: string;
  }[];
  for (const [column, sql] of [
    ["payment_status", "TEXT NOT NULL DEFAULT 'request_only'"],
    ["payment_provider", "TEXT"],
    ["paid_at", "TEXT"],
  ] as const)
    if (!columns.some((c) => c.name === column))
      db.exec(`ALTER TABLE orders ADD COLUMN ${column} ${sql}`);
  return db;
}
const attempt = (value: unknown) => {
  const a = value as PaymentAttempt;
  return { ...a, amount_minor: Number(a.amount_minor), reserved: !!a.reserved };
};
async function rpc(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await privileged().rpc(name, args);
  if (error) throw Error(error.message);
  return data;
}
export async function getPaymentSettings(): Promise<PaymentSettings> {
  if (isLive) {
    const { data, error } = await (
      await supabase()
    ).rpc("payment_public_settings");
    if (error) throw Error("PAYMENT_SETUP_REQUIRED");
    return data;
  }
  const row = paymentDB()
    .prepare(
      "SELECT provider,mode,enabled FROM payment_settings WHERE id='site'",
    )
    .get()!;
  return {
    provider: row.provider as PaymentSettings["provider"],
    mode: row.mode as PaymentSettings["mode"],
    enabled: !!row.enabled,
  };
}
export async function setPaymentSettings(value: PaymentSettings) {
  if (isLive) {
    const { error } = await (
      await supabase()
    )
      .from("payment_settings")
      .update(value)
      .eq("id", "site");
    if (error) throw error;
  } else
    paymentDB()
      .prepare(
        "UPDATE payment_settings SET provider=?,mode=?,enabled=? WHERE id='site'",
      )
      .run(value.provider, value.mode, Number(value.enabled));
}
export async function findPayment(
  value: string,
  by: "id" | "merchant_ref" = "id",
): Promise<PaymentAttempt | null> {
  if (isLive) {
    const { data, error } = await privileged()
      .from("payment_attempts")
      .select("*")
      .eq(by, value)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { data: owner, error: ownerError } = await privileged()
      .from("orders")
      .select("guest_key")
      .eq("id", data.order_id)
      .single();
    if (ownerError) throw ownerError;
    return { ...attempt(data), guest_key: owner.guest_key };
  }
  const row = paymentDB()
    .prepare(
      `SELECT a.*,o.guest_key FROM payment_attempts a JOIN orders o ON o.id=a.order_id WHERE a.${by}=?`,
    )
    .get(value);
  return row ? attempt(row) : null;
}
export async function paymentOrder(a: PaymentAttempt): Promise<PaymentOrder> {
  if (isLive) {
    const db = privileged(),
      { data: o, error } = await db
        .from("orders")
        .select("reference,customer_name,email,phone,address,total")
        .eq("id", a.order_id)
        .single();
    if (error) throw error;
    const { data: items, error: itemsError } = await db
      .from("order_items")
      .select("title,quantity,unit_price,variant_id")
      .eq("order_id", a.order_id);
    if (itemsError) throw itemsError;
    return { ...o, items } as PaymentOrder;
  }
  const db = paymentDB(),
    o = db
      .prepare(
        "SELECT reference,customer_name,email,phone,address,total FROM orders WHERE id=?",
      )
      .get(a.order_id)!;
  return {
    ...o,
    items: db
      .prepare(
        "SELECT title,quantity,unit_price,variant_id FROM order_items WHERE order_id=?",
      )
      .all(a.order_id),
  } as unknown as PaymentOrder;
}
function event(id: string, kind: string) {
  paymentDB()
    .prepare("INSERT INTO payment_events VALUES(?,?,?,?)")
    .run(randomUUID(), id, kind, new Date().toISOString());
}
export async function expirePayments() {
  if (isLive) return Number(await rpc("expire_payment_attempts"));
  const db = paymentDB();
  db.exec("BEGIN IMMEDIATE");
  try {
    const rows = db
      .prepare(
        "SELECT * FROM payment_attempts WHERE state IN('creating','ready','unknown') AND expires_at<?",
      )
      .all(new Date().toISOString()) as unknown as PaymentAttempt[];
    for (const a of rows) {
      db.prepare("UPDATE payment_attempts SET state='expired' WHERE id=?").run(
        a.id,
      );
      db.prepare(
        "UPDATE orders SET payment_status='expired',status='cancelled' WHERE id=?",
      ).run(a.order_id);
      event(a.id, "expired");
    }
    db.exec("COMMIT");
    return rows.length;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export async function preparePayment(
  reference: string,
  owner: string | { guestKey: string },
  expected: { provider: "paytr" | "iyzico"; mode: "test" | "live" },
) {
  if (isLive) {
    const data = await rpc(
      typeof owner === "string" ? "prepare_payment" : "prepare_guest_payment",
      {
        order_reference: reference,
        ...(typeof owner === "string"
          ? { buyer_id: owner }
          : { session_key: owner.guestKey }),
        expected_provider: expected.provider,
        expected_mode: expected.mode,
      },
    );
    return { ...attempt(data), created: !!data.created };
  }
  const db = paymentDB();
  db.exec("BEGIN IMMEDIATE");
  try {
    const o = db
      .prepare(
        `SELECT * FROM orders WHERE reference=? AND ${typeof owner === "string" ? "customer_id" : "guest_key"}=?`,
      )
      .get(reference, typeof owner === "string" ? owner : owner.guestKey);
    if (!o) throw Error("AUTH_REQUIRED");
    const existing = db
      .prepare("SELECT * FROM payment_attempts WHERE order_id=?")
      .get(o.id as string);
    if (existing) {
      if (
        existing.provider !== expected.provider ||
        existing.mode !== expected.mode
      )
        throw Error("PAYMENT_CONFIGURATION_CHANGED");
      db.exec("COMMIT");
      return { ...attempt(existing), created: false };
    }
    const cfg = db
      .prepare("SELECT * FROM payment_settings WHERE id='site'")
      .get()!;
    if (!cfg.enabled || cfg.provider === "none")
      throw Error("PAYMENTS_DISABLED");
    if (cfg.provider !== expected.provider || cfg.mode !== expected.mode)
      throw Error("PAYMENT_CONFIGURATION_CHANGED");
    if (cfg.mode === "live") throw Error("LIVE_REQUIRES_SUPABASE");
    if (
      !["request_pending", "demo_request"].includes(String(o.status)) ||
      Date.parse(String(o.created_at)) < Date.now() - 1800000
    )
      throw Error("ORDER_EXPIRED");
    const items = db
      .prepare(
        "SELECT i.*,p.published,p.matte_enabled,v.finish FROM order_items i JOIN products p ON p.id=i.product_id JOIN variants v ON v.id=i.variant_id AND v.product_id=i.product_id WHERE i.order_id=?",
      )
      .all(o.id as string);
    if (!items.length) throw Error("INVALID_AMOUNT");
    for (const item of items)
      if (!item.published || (item.finish === "matte" && !item.matte_enabled))
        throw Error("INVALID_VARIANT");
    const amount = items.reduce(
      (n, i) => n + minorUnits(i.unit_price) * Number(i.quantity),
      0,
    );
    if (amount <= 0 || amount !== minorUnits(o.total))
      throw Error("INVALID_AMOUNT");
    const id = randomUUID(),
      now = new Date().toISOString();
    db.prepare(
      "INSERT INTO payment_attempts VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      o.id as string,
      typeof owner === "string" ? owner : null,
      cfg.provider as string,
      "test",
      "creating",
      amount,
      "TRY",
      "KZ" + id.replaceAll("-", ""),
      null,
      null,
      null,
      0,
      now,
      new Date(Date.now() + 1800000).toISOString(),
      null,
    );
    db.prepare(
      "UPDATE orders SET payment_status='pending',payment_provider=? WHERE id=?",
    ).run(cfg.provider as string, o.id as string);
    event(id, "created");
    db.exec("COMMIT");
    return { ...(await findPayment(id))!, created: true };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export async function readyPayment(id: string, token: string, url: string) {
  if (isLive) {
    await rpc("ready_payment", {
      attempt_id: id,
      provider_token: token,
      provider_url: url,
    });
    return;
  }
  paymentDB()
    .prepare(
      "UPDATE payment_attempts SET state='ready',token=?,checkout_url=? WHERE id=? AND state='creating'",
    )
    .run(token, url, id);
}
export async function initializationFailed(id: string, ambiguous: boolean) {
  if (isLive) {
    await rpc("payment_initialization_failed", { attempt_id: id, ambiguous });
    return;
  }
  const db = paymentDB();
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare("SELECT * FROM payment_attempts WHERE id=?").get(id),
      a = row ? attempt(row) : null;
    if (a?.state === "creating") {
      db.prepare(
        "UPDATE payment_attempts SET state=?,error_code=? WHERE id=?",
      ).run(
        ambiguous ? "unknown" : "failed",
        ambiguous ? "INITIALIZATION_UNKNOWN" : "INITIALIZATION_REJECTED",
        id,
      );
      if (!ambiguous)
        db.prepare(
          "UPDATE orders SET payment_status='failed',status='cancelled' WHERE id=?",
        ).run(a.order_id);
      event(id, ambiguous ? "initialization_unknown" : "initialization_failed");
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export async function settlePayment(
  id: string,
  result: {
    paid: boolean;
    amount: number;
    currency: string;
    paymentId: string;
    review: boolean;
  },
) {
  if (isLive)
    return (await rpc("settle_payment", {
      attempt_id: id,
      was_paid: result.paid,
      received_amount: result.amount,
      received_currency: result.currency,
      transaction_id: result.paymentId,
      requires_review: result.review,
    })) as PaymentAttempt["state"];
  const db = paymentDB();
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare("SELECT * FROM payment_attempts WHERE id=?").get(id),
      a = row ? attempt(row) : null;
    if (!a) throw Error("PAYMENT_NOT_FOUND");
    if (["paid", "test_paid", "review"].includes(a.state)) {
      db.exec("COMMIT");
      return a.state;
    }
    if (!result.paid && ["failed", "expired"].includes(a.state)) {
      db.exec("COMMIT");
      return a.state;
    }
    const state = result.paid
      ? result.review ||
        result.amount !== a.amount_minor ||
        result.currency !== "TRY"
        ? "review"
        : "test_paid"
      : "failed";
    db.prepare(
      "UPDATE payment_attempts SET state=?,provider_payment_id=? WHERE id=?",
    ).run(state, result.paymentId.slice(0, 160), id);
    db.prepare(
      "UPDATE orders SET payment_status=?,paid_at=?,status=? WHERE id=?",
    ).run(
      state,
      result.paid ? new Date().toISOString() : null,
      state === "test_paid"
        ? "demo_request"
        : state === "review"
          ? "reviewing"
          : "cancelled",
      a.order_id,
    );
    event(id, state);
    db.exec("COMMIT");
    return state;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function paymentLedger() {
  const columns =
    "id,order_id,merchant_ref,provider,mode,state,provider_payment_id,expires_at,error_code,amount_minor";
  if (isLive) {
    const { data, error } = await (
      await supabase()
    )
      .from("payment_attempts")
      .select(columns)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return data;
  }
  return paymentDB()
    .prepare(
      "SELECT " +
        columns +
        " FROM payment_attempts ORDER BY created_at DESC LIMIT 1000",
    )
    .all();
}
