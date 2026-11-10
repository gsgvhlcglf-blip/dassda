import "server-only";
import { randomUUID } from "node:crypto";
import { isLive, localDB } from "@/lib/database";
import { privileged } from "./privileged";
import { getRole } from "@/lib/auth";
import type { NoticeJob, OrderNotice } from "@/lib/order-emails";

const columns =
  "id,order_id,kind,version,status,attempts,created_at,first_attempt_at,sent_at,error";
async function ready() {
  await (await import("./payments")).getPaymentSettings();
}
async function admin() {
  if ((await getRole()) !== "admin") throw Error("FORBIDDEN");
}
export async function listNotices(orderId: string): Promise<OrderNotice[]> {
  await admin();
  await ready();
  if (isLive) {
    const { data, error } = await privileged()
      .from("order_notifications")
      .select(columns)
      .eq("order_id", orderId)
      .order("created_at");
    if (error) throw error;
    return data as OrderNotice[];
  }
  return localDB()
    .prepare(
      `SELECT ${columns} FROM order_notifications WHERE order_id=? ORDER BY created_at`,
    )
    .all(orderId) as unknown as OrderNotice[];
}
export async function claimNotice(): Promise<NoticeJob | null> {
  await ready();
  const lease = randomUUID();
  let row: Record<string, unknown> | undefined;
  if (isLive) {
    const { data, error } = await privileged().rpc("claim_order_notice", {
      lease,
    });
    if (error) throw error;
    if (!data) return null;
    row = data;
  } else {
    localDB()
      .prepare(
        "UPDATE order_notifications SET status='review',error='EMAIL_RETRY_WINDOW_EXPIRED' WHERE status IN('pending','sending') AND first_attempt_at<=?",
      )
      .run(new Date(Date.now() - 23 * 3600000).toISOString());
    const now = new Date().toISOString(),
      until = new Date(Date.now() + 120000).toISOString();
    row = localDB()
      .prepare(
        "UPDATE order_notifications SET status='sending',lease_token=?,lease_until=?,attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,?) WHERE id=(SELECT id FROM order_notifications WHERE ((status='pending' AND next_attempt_at<=?) OR (status='sending' AND lease_until<?)) AND (first_attempt_at IS NULL OR first_attempt_at>?) AND attempts<5 ORDER BY created_at LIMIT 1) RETURNING *",
      )
      .get(
        lease,
        until,
        now,
        now,
        now,
        new Date(Date.now() - 23 * 3600000).toISOString(),
      );
  }
  if (!row) return null;
  let order: unknown;
  if (isLive) {
    const db = privileged();
    const [{ data, error }, items] = await Promise.all([
      db.from("orders").select("*").eq("id", row.order_id).single(),
      db.from("order_items").select("*").eq("order_id", row.order_id),
    ]);
    if (error || items.error) throw Error("NOTICE_ORDER_UNAVAILABLE");
    order = { ...data, items: items.data };
  } else {
    const db = localDB();
    order = {
      ...db
        .prepare("SELECT * FROM orders WHERE id=?")
        .get(row.order_id as string),
      items: db
        .prepare("SELECT * FROM order_items WHERE order_id=?")
        .all(row.order_id as string),
    };
  }
  return { ...row, order } as NoticeJob;
}
export async function finishNotice(
  id: string,
  lease: string,
  providerId: string | null,
  error: string | null,
) {
  if (isLive) {
    const { error: failure } = await privileged().rpc("finish_order_notice", {
      notice_id: id,
      lease,
      provider_id: providerId,
      failure: error,
    });
    if (failure) throw failure;
    return;
  }
  localDB()
    .prepare(
      "UPDATE order_notifications SET status=case when ? IS NOT NULL then 'sent' when ? IN('NOTICE_NOT_ELIGIBLE','NOTICE_SUPERSEDED','EMAIL_CONFIGURATION_REJECTED') OR attempts>=5 then 'review' else 'pending' end,provider_id=?,sent_at=?,error=?,next_attempt_at=?,lease_until=NULL WHERE id=? AND lease_token=? AND status='sending'",
    )
    .run(
      providerId,
      error,
      providerId,
      providerId ? new Date().toISOString() : null,
      error,
      new Date(Date.now() + 60000).toISOString(),
      id,
      lease,
    );
}
export async function retryNotices(orderId: string) {
  await admin();
  await ready();
  if (isLive) {
    const { error } = await privileged().rpc("retry_order_notices", {
      target_order: orderId,
    });
    if (error) throw error;
  } else {
    const changed = localDB()
      .prepare(
        "UPDATE order_notifications SET status='pending',next_attempt_at=?,attempts=0 WHERE order_id=? AND status IN('pending','review','failed') AND (first_attempt_at IS NULL OR first_attempt_at>?) AND coalesce(error,'') NOT IN('NOTICE_NOT_ELIGIBLE','NOTICE_SUPERSEDED')",
      )
      .run(
        new Date().toISOString(),
        orderId,
        new Date(Date.now() - 23 * 3600000).toISOString(),
      );
    if (!changed.changes) throw Error("NOTICE_RETRY_UNAVAILABLE");
  }
}
