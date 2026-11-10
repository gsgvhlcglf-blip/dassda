import { after } from "next/server";
import { dispatchOrderNotices } from "@/server/order-notifications";
import { paymentCredentials } from "@/lib/payments/config";
import { sameSignature, paytrCallbackSignature } from "@/lib/payments/protocol";
import { verifyPaytrCallback } from "@/lib/payments/providers";
import { findPayment, settlePayment } from "@/lib/payments/store";
export async function POST(req: Request) {
  try {
    const body = await req.text();
    if (body.length > 16000)
      return new Response("INVALID_REQUEST", { status: 413 });
    const params = new URLSearchParams(body),
      fields = Object.fromEntries(params),
      credentials = paymentCredentials("paytr", "test").paytr!;
    if (!credentials.key || !credentials.salt)
      return new Response("NOT_CONFIGURED", { status: 503 });
    if (
      !fields.merchant_oid ||
      !fields.status ||
      !fields.total_amount ||
      !sameSignature(
        fields.hash || "",
        paytrCallbackSignature(
          fields.merchant_oid,
          fields.status,
          fields.total_amount,
          credentials.key,
          credentials.salt,
        ),
      )
    )
      return new Response("INVALID_SIGNATURE", { status: 400 });
    const a = await findPayment(fields.merchant_oid, "merchant_ref");
    if (!a || a.provider !== "paytr")
      return new Response("NOT_FOUND", { status: 404 });
    const result = verifyPaytrCallback(fields, a, credentials);
    await settlePayment(a.id, result);
    after(async () => {
      try {
        await dispatchOrderNotices();
      } catch {
        /* Durable queue retries separately from payment acknowledgement. */
      }
    });
    return new Response("OK", {
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  } catch {
    return new Response("RETRY", { status: 500 });
  }
}
