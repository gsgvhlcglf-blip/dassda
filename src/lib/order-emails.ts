import type { ManagedOrder } from "./order-management";
import { safeShipmentURL } from "./order-management";
import { money } from "./i18n";
export type OrderNotice = {
  id: string;
  order_id: string;
  kind: "order_confirmed" | "shipment_shared";
  version: number;
  status: "pending" | "sending" | "sent" | "failed" | "review";
  attempts: number;
  created_at: string;
  first_attempt_at: string | null;
  sent_at: string | null;
  error: string | null;
};
export type NoticeJob = OrderNotice & {
  lease_token: string;
  order: ManagedOrder;
};
export function orderEmail(job: NoticeJob) {
  const o = job.order;
  if (o.demo || o.payment_status !== "paid") throw Error("NOTICE_NOT_ELIGIBLE");
  const title =
    job.kind === "order_confirmed"
      ? "Siparişiniz alındı"
      : "Siparişiniz kargoya verildi";
  const lines = [
    `Merhaba ${o.customer_name},`,
    "",
    `${title}. Sipariş numaranız: ${o.reference}`,
    "",
  ];
  if (job.kind === "shipment_shared") {
    if (
      !o.tracking_number ||
      !o.shipped_at ||
      Number(o.fulfillment_version) !== job.version
    )
      throw Error("NOTICE_SUPERSEDED");
    lines.push(
      `Kargo firması: ${o.shipping_carrier || "Sipariş destek ekibinden öğrenebilirsiniz."}`,
      `Takip numarası: ${o.tracking_number}`,
    );
    const url = safeShipmentURL(o.tracking_url);
    if (url) lines.push(`Kargo takibi: ${url}`);
  } else {
    for (const item of o.items)
      lines.push(
        `${item.title} · ${item.sku} · ${item.quantity} adet · ${money(item.unit_price * item.quantity, "tr", o.currency)}`,
      );
    lines.push(
      "",
      `Toplam: ${money(o.total, "tr", o.currency)}`,
      "Ücretsiz kargo · KDV dahil.",
      "Özel üretim ürünler 7–15 iş gününde kargoya verilir.",
      "",
      "Teslimat adresi:",
      o.address,
    );
  }
  lines.push(
    "",
    "Sipariş numaranızı saklayın. Destek talebinizde bu numarayı belirtin.",
    "KUZMIN",
  );
  return {
    to: o.email,
    subject: `${title} · ${o.reference}`,
    text: lines.join("\n"),
  };
}

/** Provider acceptance is recorded as sent; it is not proof of inbox delivery. */
export async function deliverOrderEmail(
  job: NoticeJob,
  config: { key: string; from: string; replyTo?: string },
  transport: typeof fetch = fetch,
) {
  const mail = orderEmail(job);
  const response = await transport("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `kuzmin-${job.id}`,
    },
    body: JSON.stringify({
      from: config.from,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      ...(config.replyTo ? { reply_to: config.replyTo } : {}),
    }),
  });
  if (!response.ok)
    throw Error(
      response.status === 429 || response.status >= 500
        ? "EMAIL_TEMPORARY_FAILURE"
        : "EMAIL_CONFIGURATION_REJECTED",
    );
  const result = await response.json();
  if (typeof result.id !== "string" || !result.id || result.id.length > 200)
    throw Error("EMAIL_RESPONSE_UNKNOWN");
  return result.id as string;
}
