import {
  renderOrderEmail,
  defaultEmailDesign,
  type EmailDesign,
  type FrozenEmail,
  type EmailMessage,
} from "./email-design";
import type { ManagedOrder } from "./order-management";
export type OrderNotice = {
  id: string;
  order_id: string;
  kind: "order_confirmed" | "shipment_shared" | "invoice_ready";
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
  email_payload?: FrozenEmail | null;
};
export function orderEmail(
  job: NoticeJob,
  design: EmailDesign = defaultEmailDesign,
  invoice?: { file_name: string; version: number },
): EmailMessage {
  const o = job.order;
  if (o.demo || o.payment_status !== "paid" || o.status === "cancelled")
    throw Error("NOTICE_NOT_ELIGIBLE");
  if (
    job.kind === "shipment_shared" &&
    (!o.tracking_number ||
      !o.shipped_at ||
      Number(o.fulfillment_version) !== job.version)
  )
    throw Error("NOTICE_SUPERSEDED");
  if (
    job.kind === "invoice_ready" &&
    (!invoice || invoice.version !== job.version)
  )
    throw Error("INVOICE_NOT_FOUND");
  return renderOrderEmail(job.kind, o, design, invoice);
}

/** Provider acceptance is recorded as sent; it is not proof of inbox delivery. */
export async function deliverOrderEmail(
  job: NoticeJob,
  config: { key: string; from: string; replyTo?: string },
  transport: typeof fetch = fetch,
  options?: {
    mail?: FrozenEmail;
    attachment?: { filename: string; content: string };
  },
) {
  const mail = options?.mail || orderEmail(job);
  const replyTo = options?.mail ? options.mail.replyTo : config.replyTo;
  const response = await transport("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `kuzmin-${job.id}`,
    },
    body: JSON.stringify({
      from: options?.mail?.from || config.from,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      ...(options?.attachment ? { attachments: [options.attachment] } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
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
