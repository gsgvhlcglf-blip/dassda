import "server-only";
import { repository } from "./persistence";
import { deliverOrderEmail } from "@/lib/order-emails";
import { dataProvider } from "./persistence/config";

export function notificationReadiness() {
  const local = dataProvider(process.env) === "sqlite-demo";
  const ready =
    !local &&
    process.env.EMAIL_PROVIDER === "resend" &&
    Boolean(process.env.RESEND_API_KEY) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.ORDER_EMAIL_FROM || "") &&
    (!process.env.ORDER_EMAIL_REPLY_TO ||
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.ORDER_EMAIL_REPLY_TO));
  return {
    ready,
    note: local
      ? "Yerel demo ve tasarım önizlemesinden gerçek e-posta gönderilmez."
      : ready
        ? "Sipariş ve kargo e-postaları etkin. Gönderildi durumu e-posta servisinin kabulünü belirtir."
        : "E-posta servisi bağlı değil. Bildirimler kuyrukta korunur; gönderildi olarak gösterilmez.",
  };
}
export async function dispatchOrderNotices() {
  if (!notificationReadiness().ready) return { sent: 0 };
  const store = await repository("notifications");
  let sent = 0;
  for (let i = 0; i < 5; i++) {
    const job = await store.claimNotice();
    if (!job) break;
    try {
      const providerId = await deliverOrderEmail(job, {
        key: process.env.RESEND_API_KEY!,
        from: process.env.ORDER_EMAIL_FROM!,
        replyTo: process.env.ORDER_EMAIL_REPLY_TO,
      });
      await store.finishNotice(job.id, job.lease_token, providerId, null);
      sent++;
    } catch (error) {
      const known = [
        "NOTICE_NOT_ELIGIBLE",
        "NOTICE_SUPERSEDED",
        "EMAIL_TEMPORARY_FAILURE",
        "EMAIL_CONFIGURATION_REJECTED",
        "EMAIL_RESPONSE_UNKNOWN",
      ];
      await store.finishNotice(
        job.id,
        job.lease_token,
        null,
        error instanceof Error && known.includes(error.message)
          ? error.message
          : "EMAIL_RESULT_UNKNOWN",
      );
    }
  }
  return { sent };
}
