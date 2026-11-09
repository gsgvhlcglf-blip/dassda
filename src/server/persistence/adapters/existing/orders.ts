import "server-only";
import { randomUUID } from "node:crypto";
import { isLive, localDB, insertLocal, updateLocal } from "@/lib/database";
import { getCatalog, getRows } from "@/lib/catalog";
import { quote } from "@/lib/commerce";
import { supabase } from "@/lib/supabase";
import type { CustomerIdentity, OrderInput } from "../../contracts";
import { getRole } from "@/lib/auth";
import {
  shipmentSchema,
  assertShippable,
  shippingState,
  type ManagedOrder,
  type ShipmentInput,
} from "@/lib/order-management";
import { trackingConfiguration, trackingLink } from "@/lib/tracking";

async function requireAdmin() {
  if ((await getRole()) !== "admin") throw Error("Yönetici yetkisi gerekli.");
}
export async function listOrders(): Promise<ManagedOrder[]> {
  await requireAdmin();
  const { getPaymentSettings } = await import("@/lib/payments/store");
  await getPaymentSettings();
  const [orders, items, attempts] = await Promise.all([
    getRows("orders"),
    getRows("order_items"),
    orderPaymentReferences(),
  ]);
  return orders
    .map((order) => {
      const payment = attempts.find((attempt) => attempt.order_id === order.id);
      return {
        ...order,
        items: items.filter((item) => item.order_id === order.id),
        payment_reference:
          payment?.provider_payment_id || payment?.merchant_ref || "",
      } as ManagedOrder;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
async function orderPaymentReferences() {
  if (!isLive)
    return localDB()
      .prepare(
        "SELECT order_id,merchant_ref,provider_payment_id FROM payment_attempts",
      )
      .all();
  const db = await supabase(),
    rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db
      .from("payment_attempts")
      .select("order_id,merchant_ref,provider_payment_id")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
export async function shareTracking(
  id: string,
  value: ShipmentInput,
): Promise<ManagedOrder> {
  await requireAdmin();
  const input = shipmentSchema.parse(value),
    config = trackingConfiguration(await getCatalog(), "tr");
  const carrier = input.shipping_carrier || config.carrier;
  const sameCarrier =
    !input.shipping_carrier ||
    input.shipping_carrier.toLocaleLowerCase("tr") ===
      config.carrier.toLocaleLowerCase("tr");
  const url =
    config.ready && sameCarrier
      ? trackingLink(config.template, input.tracking_number) || ""
      : "";
  if (isLive) {
    const { error } = await (
      await supabase()
    ).rpc("share_order_tracking", {
      p_order_id: id,
      p_tracking_number: input.tracking_number,
      p_carrier: carrier,
      p_tracking_url: url,
      p_expected_version: input.expected_version,
    });
    if (error) throw Error(error.message);
  } else {
    await import("@/lib/payments/store").then((m) => m.getPaymentSettings());
    const db = localDB();
    db.exec("BEGIN IMMEDIATE");
    try {
      const order = db
        .prepare("SELECT * FROM orders WHERE id=?")
        .get(id) as unknown as ManagedOrder | undefined;
      if (!order) throw Error("Sipariş bulunamadı.");
      assertShippable(order);
      if (Number(order.fulfillment_version) !== input.expected_version)
        throw Error("ORDER_CONFLICT");
      db.prepare(
        "UPDATE orders SET tracking_number=?,shipping_carrier=?,tracking_url=?,shipped_at=coalesce(shipped_at,?),status='shipped',fulfillment_version=fulfillment_version+1 WHERE id=?",
      ).run(input.tracking_number, carrier, url, new Date().toISOString(), id);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  const result = (await listOrders()).find((order) => order.id === id);
  if (!result) throw Error("Sipariş bulunamadı.");
  return result;
}

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
    status === "shipped" &&
    shippingState(current as unknown as ManagedOrder) !== "shipped"
  )
    throw Error("Önce kargo takip numarasını paylaşın.");
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
