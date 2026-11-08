import "server-only";
import { randomUUID } from "node:crypto";
import { isLive, localDB, insertLocal, updateLocal } from "@/lib/database";
import { getCatalog, getRows } from "@/lib/catalog";
import { quote } from "@/lib/commerce";
import { supabase } from "@/lib/supabase";
import type { CustomerIdentity, OrderInput } from "../../contracts";

export async function createOrder(
  input: OrderInput,
  customer: CustomerIdentity,
) {
  input = { ...input, email: customer.email };
  if (isLive) {
    const { data, error } = await (
      await supabase()
    ).rpc("create_order_request", { input });
    if (error) throw Error(error.message);
    return data as { reference: string; demo: boolean; total: number };
  }
  const db = localDB();
  db.exec("BEGIN IMMEDIATE");
  try {
    const q = quote(await getCatalog(), input.lines),
      id = randomUUID(),
      reference = `KZ-${randomUUID().slice(0, 8).toUpperCase()}`;
    insertLocal("orders", {
      id,
      reference,
      customer_id: customer.id,
      customer_name: input.customer_name,
      email: customer.email,
      phone: input.phone,
      address: input.address,
      note: input.note,
      status: "demo_request",
      total: q.total,
      currency: "TRY",
      demo: true,
      created_at: new Date().toISOString(),
    });
    for (const line of q.items)
      insertLocal("order_items", {
        id: randomUUID(),
        order_id: id,
        product_id: line.product.id,
        variant_id: line.variant.id,
        title: line.product.title[input.locale],
        sku: line.variant.sku,
        quantity: line.quantity,
        unit_price: line.unit_price,
      });
    db.exec("COMMIT");
    return { reference, demo: true, total: q.total };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function updateOrderStatus(id: string, status: string) {
  const current = (await getRows("orders")).find((row) => row.id === id);
  if (!current) throw Error("Sipariş bulunamadı.");
  if (
    current.payment_provider &&
    ["confirmed", "shipped"].includes(status) &&
    current.payment_status !== "paid"
  )
    throw Error(
      "Kartlı siparişte ödeme doğrulanmadan onay veya gönderim yapılamaz.",
    );
  if (isLive) {
    const { error } = await (
      await supabase()
    )
      .from("orders")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
  } else updateLocal("orders", { ...current, status });
}
