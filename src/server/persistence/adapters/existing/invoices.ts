import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { localDB, isLive } from "@/lib/database";
import { getRole } from "@/lib/auth";
import { validateInvoice } from "@/lib/invoices";
import type { InvoiceMeta, InvoiceUpload } from "@/lib/email-design";
import { privileged } from "./privileged";
type StoredInvoice = InvoiceMeta & { storage_key: string };
const bucket = "order-invoices";
const publicMeta = ({ storage_key, ...meta }: StoredInvoice): InvoiceMeta =>
  meta;
async function ready() {
  await (await import("./payments")).getPaymentSettings();
}
async function admin() {
  if ((await getRole()) !== "admin") throw Error("FORBIDDEN");
}
async function rows(orderId: string): Promise<StoredInvoice[]> {
  await ready();
  if (isLive) {
    const { data, error } = await privileged()
      .from("order_invoices")
      .select("*")
      .eq("order_id", orderId)
      .order("version", { ascending: false });
    if (error) throw error;
    return data as StoredInvoice[];
  }
  return localDB()
    .prepare(
      "SELECT * FROM order_invoices WHERE order_id=? ORDER BY version DESC",
    )
    .all(orderId) as unknown as StoredInvoice[];
}
export async function listInvoices(orderId: string) {
  await admin();
  return (await rows(orderId)).map(publicMeta);
}
async function fileBytes(row: StoredInvoice) {
  if (!/^[a-f0-9-]{36}\.pdf$/.test(row.storage_key))
    throw Error("INVOICE_NOT_FOUND");
  let bytes: Buffer;
  if (isLive) {
    const { data, error } = await privileged()
      .storage.from(bucket)
      .download(row.storage_key);
    if (error) throw error;
    bytes = Buffer.from(await data.arrayBuffer());
  } else
    bytes = await readFile(
      join(process.cwd(), ".data", "invoices", row.storage_key),
    );
  if (
    bytes.length !== Number(row.size) ||
    createHash("sha256").update(bytes).digest("hex") !== row.sha256
  )
    throw Error("INVOICE_INTEGRITY_FAILED");
  return { invoice: publicMeta(row), bytes };
}
export async function readInvoice(orderId: string, invoiceId: string) {
  await admin();
  const row = (await rows(orderId)).find((i) => i.id === invoiceId);
  if (!row) throw Error("INVOICE_NOT_FOUND");
  return fileBytes(row);
}
export async function invoiceForEmail(orderId: string, version: number) {
  const all = await rows(orderId);
  if (all[0]?.version !== version) throw Error("NOTICE_SUPERSEDED");
  const row = all.find((i) => i.version === version);
  if (!row) throw Error("INVOICE_NOT_FOUND");
  return fileBytes(row);
}
async function remove(key: string) {
  if (isLive) {
    const { error } = await privileged().storage.from(bucket).remove([key]);
    if (error) throw error;
  } else await unlink(join(process.cwd(), ".data", "invoices", key));
}
export async function uploadInvoice(
  orderId: string,
  input: InvoiceUpload,
): Promise<InvoiceMeta> {
  await admin();
  await ready();
  const fileName = validateInvoice(
    input.bytes,
    input.fileName,
    "application/pdf",
  );
  const sha = createHash("sha256").update(input.bytes).digest("hex");
  let order: Record<string, unknown> | null | undefined;
  if (isLive) {
    const { data, error } = await privileged()
      .from("orders")
      .select("id,payment_status,status")
      .eq("id", orderId)
      .single();
    if (error) throw error;
    order = data;
  } else
    order = localDB()
      .prepare("SELECT id,payment_status,status FROM orders WHERE id=?")
      .get(orderId);
  if (!order || order.payment_status !== "paid" || order.status === "cancelled")
    throw Error("Fatura için sipariş ödemesi doğrulanmış olmalıdır.");
  const previous = await rows(orderId);
  if (previous[0]?.sha256 === sha) return publicMeta(previous[0]);
  if (previous.some((i) => i.sha256 === sha))
    throw Error("Bu fatura daha önce yüklenmiş. Güncel PDF dosyasını seçin.");
  if ((previous[0]?.version || 0) !== input.expected)
    throw Error("INVOICE_CONFLICT");
  const id = randomUUID(),
    key = id + ".pdf";
  if (isLive) {
    const { error } = await privileged()
      .storage.from(bucket)
      .upload(key, input.bytes, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (error) throw Error("Özel fatura deposuna yüklenemedi.");
  } else {
    const directory = join(process.cwd(), ".data", "invoices");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, key), input.bytes, {
      flag: "wx",
      mode: 0o600,
    });
  }
  try {
    let result: StoredInvoice;
    if (isLive) {
      const { data, error } = await privileged().rpc("register_order_invoice", {
        invoice_id: id,
        target_order: orderId,
        expected: input.expected,
        filename: fileName,
        object_key: key,
        file_size: input.bytes.length,
        file_hash: sha,
      });
      if (error) throw Error(error.message);
      result = data;
    } else {
      const db = localDB();
      db.exec("BEGIN IMMEDIATE");
      try {
        const current = db
          .prepare(
            "SELECT version,sha256 FROM order_invoices WHERE order_id=? ORDER BY version DESC LIMIT 1",
          )
          .get(orderId);
        if (current?.sha256 === sha) {
          result = db
            .prepare(
              "SELECT * FROM order_invoices WHERE order_id=? AND sha256=?",
            )
            .get(orderId, sha) as unknown as StoredInvoice;
        } else {
          if (Number(current?.version || 0) !== input.expected)
            throw Error("INVOICE_CONFLICT");
          const currentOrder = db
            .prepare("SELECT payment_status,status FROM orders WHERE id=?")
            .get(orderId);
          if (
            currentOrder?.payment_status !== "paid" ||
            currentOrder.status === "cancelled"
          )
            throw Error("Fatura için sipariş ödemesi doğrulanmış olmalıdır.");
          result = {
            id,
            order_id: orderId,
            version: input.expected + 1,
            file_name: fileName,
            storage_key: key,
            size: input.bytes.length,
            sha256: sha,
            created_at: new Date().toISOString(),
          };
          db.prepare(
            "INSERT INTO order_invoices(id,order_id,version,file_name,storage_key,size,sha256,created_at) VALUES(?,?,?,?,?,?,?,?)",
          ).run(
            id,
            orderId,
            result.version,
            fileName,
            key,
            result.size,
            sha,
            result.created_at,
          );
        }
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    }
    if (result.storage_key !== key) {
      try {
        await remove(key);
      } catch {
        /* Unlinked duplicate can be cleaned up later. */
      }
    }
    return publicMeta(result);
  } catch (error) {
    // A lost RPC response may follow a committed invoice: never delete a linked PDF.
    try {
      if (!(await rows(orderId)).some((i) => i.storage_key === key))
        await remove(key);
    } catch {
      /* Keep uncertain files until reconciliation. */
    }
    throw error;
  }
}
