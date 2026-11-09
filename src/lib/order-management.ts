import { z } from "zod";
import type { Order, OrderItem } from "./types";

export type OrderShipment = {
  tracking_number?: string;
  shipping_carrier?: string;
  tracking_url?: string;
  shipped_at?: string | null;
  fulfillment_version?: number;
};
export type ManagedOrder = Order &
  OrderShipment & {
    payment_status?: string;
    payment_provider?: string | null;
    paid_at?: string | null;
    payment_reference?: string;
    items: OrderItem[];
  };
export const shipmentSchema = z
  .object({
    tracking_number: z
      .string()
      .trim()
      .regex(
        /^[a-zA-Z0-9-]{3,80}$/,
        "3–80 karakterlik geçerli bir takip numarası girin.",
      ),
    shipping_carrier: z.string().trim().max(120).default(""),
    expected_version: z.number().int().min(0),
  })
  .strict();
export type ShipmentInput = z.infer<typeof shipmentSchema>;
export function shippingState(order: OrderShipment) {
  return order.tracking_number?.trim() && order.shipped_at
    ? "shipped"
    : "preparing";
}
export function shippingLabel(order: OrderShipment) {
  return shippingState(order) === "shipped"
    ? "Siparişiniz kargoya verildi"
    : "Sipariş hazırlanıyor";
}
export function assertShippable(
  order: Pick<ManagedOrder, "status" | "payment_provider" | "payment_status">,
) {
  if (order.status === "cancelled")
    throw Error("İptal edilmiş siparişin kargo bilgisi paylaşılamaz.");
  if (order.payment_provider && order.payment_status !== "paid")
    throw Error("Ödeme doğrulanmadan kargo bilgisi paylaşılamaz.");
}
export function safeShipmentURL(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
