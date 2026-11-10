import "server-only";
import { repository } from "./persistence";
import { deliverOrderEmail, orderEmail } from "@/lib/order-emails";
import { dataProvider } from "./persistence/config";
import { mailReadiness, smtpSettings } from "./mail/config";
import { sendSMTPEmail } from "./mail/smtp";

export async function notificationReadiness() {
  const local = dataProvider(process.env) === "sqlite-demo";
  const settings = local
    ? null
    : (await (await repository("notifications")).getEmailDesign()).settings;
  const sender = settings?.senderEmail || process.env.ORDER_EMAIL_FROM || "";
  const reply = settings?.replyTo || process.env.ORDER_EMAIL_REPLY_TO || "";
  const connection = mailReadiness(process.env, sender, reply);
  const ready = !local && connection.ready;
  return {
    ready,
    sender,
    provider: connection.provider,
    note: local
      ? "Yerel demo ve tasarım önizlemesinden gerçek e-posta gönderilmez."
      : ready
        ? "Sipariş, kargo ve fatura e-postaları etkin. Gönderildi durumu e-posta servisinin kabulünü belirtir."
        : "Gönderici veya e-posta servisi bağlı değil. Bildirimler kuyrukta korunur; gönderildi olarak gösterilmez.",
  };
}
export async function dispatchOrderNotices() {
  if (!(await notificationReadiness()).ready) return { sent: 0 };
  const store = await repository("notifications");
  const design = (await store.getEmailDesign()).settings;
  const provider = process.env.EMAIL_PROVIDER as "smtp" | "resend";
  let sent = 0;
  for (let i = 0; i < 5; i++) {
    const job = await store.claimNotice();
    if (!job) break;
    try {
      const attachment =
        job.kind === "invoice_ready"
          ? await (
              await repository("invoices")
            ).invoiceForEmail(job.order_id, job.version)
          : null;
      const rendered = orderEmail(job, design, attachment?.invoice);
      const frozen = await store.freezeNotice(
        job.id,
        job.lease_token,
        job.email_payload || {
          ...rendered,
          provider,
          from: design.senderEmail || process.env.ORDER_EMAIL_FROM!,
          replyTo:
            design.replyTo || process.env.ORDER_EMAIL_REPLY_TO || undefined,
          ...(attachment
            ? {
                invoice: {
                  id: attachment.invoice.id,
                  sha256: attachment.invoice.sha256,
                  fileName: attachment.invoice.file_name,
                },
              }
            : {}),
        },
      );
      if (
        attachment &&
        (frozen.invoice?.id !== attachment.invoice.id ||
          frozen.invoice.sha256 !== attachment.invoice.sha256)
      )
        throw Error("INVOICE_INTEGRITY_FAILED");
      // Legacy frozen payloads were sent through Resend; switching providers cannot retry them.
      if ((frozen.provider || "resend") !== provider)
        throw Error("EMAIL_PROVIDER_CHANGED");
      const emailAttachment = attachment
        ? {
            filename: frozen.invoice!.fileName,
            content: attachment.bytes.toString("base64"),
          }
        : undefined;
      const providerId =
        provider === "smtp"
          ? await sendSMTPEmail(
              job.id,
              frozen,
              emailAttachment,
              smtpSettings(process.env)!,
            )
          : await deliverOrderEmail(
              job,
              {
                key: process.env.RESEND_API_KEY!,
                from: frozen.from,
                replyTo: frozen.replyTo,
              },
              fetch,
              {
                mail: frozen,
                ...(attachment
                  ? {
                      attachment: {
                        filename: frozen.invoice!.fileName,
                        content: attachment.bytes.toString("base64"),
                      },
                    }
                  : {}),
              },
            );
      await store.finishNotice(job.id, job.lease_token, providerId, null);
      sent++;
    } catch (error) {
      const known = [
        "NOTICE_NOT_ELIGIBLE",
        "NOTICE_SUPERSEDED",
        "EMAIL_TEMPORARY_FAILURE",
        "EMAIL_CONFIGURATION_REJECTED",
        "EMAIL_RESPONSE_UNKNOWN",
        "EMAIL_SMTP_RESULT_UNKNOWN",
        "EMAIL_PROVIDER_CHANGED",
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
