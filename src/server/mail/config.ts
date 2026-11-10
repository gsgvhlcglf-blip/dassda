/** Pure server configuration parsing. Never return the SMTP password to an API. */
export type MailEnvironment = Record<string, string | undefined>;
export type SMTPSettings = {
  host: string;
  port: 465 | 587;
  user: string;
  password: string;
};
export function smtpSettings(env: MailEnvironment): SMTPSettings | null {
  const host = env.SMTP_HOST?.trim() || "",
    port = Number(env.SMTP_PORT || 465);
  if (
    !/^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host) ||
    ![465, 587].includes(port) ||
    !env.SMTP_USER?.trim() ||
    !env.SMTP_PASSWORD
  )
    return null;
  return {
    host,
    port: port as 465 | 587,
    user: env.SMTP_USER.trim(),
    password: env.SMTP_PASSWORD,
  };
}
export function mailReadiness(
  env: MailEnvironment,
  sender: string,
  replyTo = "",
) {
  const provider = env.EMAIL_PROVIDER || "disabled";
  const missing: string[] = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender))
    missing.push("Satış e-posta adresi");
  if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo))
    missing.push("Yanıt adresi");
  if (provider === "smtp") {
    if (!smtpSettings(env)) missing.push("SMTP sunucu/port/hesap ayarları");
  } else if (provider === "resend") {
    if (!env.RESEND_API_KEY) missing.push("E-posta servisi yetkisi");
  } else missing.push("E-posta gönderim bağlantısı");
  return { provider, ready: missing.length === 0, missing };
}
export function smtpFailure(error: unknown) {
  const e = error as { code?: string; errno?: string; responseCode?: number };
  if (e?.responseCode && e.responseCode >= 400 && e.responseCode < 500)
    return "EMAIL_TEMPORARY_FAILURE";
  if (
    (e?.responseCode && e.responseCode >= 500) ||
    ["EAUTH", "ETLS", "EENVELOPE"].includes(e?.code || "")
  )
    return "EMAIL_CONFIGURATION_REJECTED";
  if (
    [e?.code, e?.errno].some((code) =>
      ["EDNS", "ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND"].includes(code || ""),
    )
  )
    return "EMAIL_TEMPORARY_FAILURE";
  // SMTP has no provider idempotency API: a lost DATA acknowledgement is not retried.
  return "EMAIL_SMTP_RESULT_UNKNOWN";
}
