import "server-only";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { createHash } from "node:crypto";
import { domainToASCII } from "node:url";
import type { FrozenEmail } from "@/lib/email-design";
import { smtpFailure, type SMTPSettings } from "./config";

export function smtpOptions(settings: SMTPSettings): SMTPTransport.Options {
  return {
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    requireTLS: settings.port === 587,
    auth: { user: settings.user, pass: settings.password },
    tls: { rejectUnauthorized: true, servername: settings.host },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  };
}
export async function sendSMTPEmail(
  jobId: string,
  mail: FrozenEmail,
  attachment: { filename: string; content: string } | undefined,
  settings: SMTPSettings,
  factory = nodemailer.createTransport,
) {
  const transport = factory(smtpOptions(settings));
  try {
    const domain =
      domainToASCII(mail.from.split("@")[1] || "") || "orders.invalid";
    const messageId = `<kuzmin.${createHash("sha256").update(jobId).digest("hex").slice(0, 40)}@${domain}>`;
    const info = await transport.sendMail({
      from: mail.from,
      to: mail.to,
      replyTo: mail.replyTo,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      messageId,
      disableFileAccess: true,
      disableUrlAccess: true,
      ...(attachment
        ? {
            attachments: [
              {
                filename: attachment.filename,
                content: Buffer.from(attachment.content, "base64"),
                contentType: "application/pdf",
              },
            ],
          }
        : {}),
    });
    if (!info.accepted?.length || info.rejected?.length)
      throw Error("EMAIL_SMTP_RESULT_UNKNOWN");
    return info.messageId || messageId;
  } catch (error) {
    throw Error(
      error instanceof Error && error.message === "EMAIL_SMTP_RESULT_UNKNOWN"
        ? error.message
        : smtpFailure(error),
    );
  } finally {
    transport.close();
  }
}
