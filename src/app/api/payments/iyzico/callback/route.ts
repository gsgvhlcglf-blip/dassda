import { after } from "next/server";
import { dispatchOrderNotices } from "@/server/order-notifications";
import { NextResponse } from "next/server";
import { z } from "zod";
import { paymentCredentials, paymentOrigin } from "@/lib/payments/config";
import { retrieveIyzico } from "@/lib/payments/providers";
import { findPayment, settlePayment } from "@/lib/payments/store";
import { sameSignature } from "@/lib/payments/protocol";
export async function POST(req: Request) {
  try {
    const id = z.uuid().parse(new URL(req.url).searchParams.get("attempt")),
      body = await req.text();
    if (body.length > 4000)
      return new Response("INVALID_REQUEST", { status: 413 });
    const token = z
      .string()
      .min(10)
      .max(256)
      .parse(new URLSearchParams(body).get("token"));
    const a = await findPayment(id);
    if (
      !a ||
      a.provider !== "iyzico" ||
      !a.token ||
      !sameSignature(a.token, token)
    )
      return new Response("INVALID_TOKEN", { status: 400 });
    if (!paymentOrigin())
      return new Response("NOT_CONFIGURED", { status: 503 });
    if (!["paid", "test_paid", "review"].includes(a.state))
      await settlePayment(
        id,
        await retrieveIyzico(
          a,
          token,
          paymentCredentials("iyzico", a.mode).iyzico!,
        ),
      );
    after(async () => {
      try {
        await dispatchOrderNotices();
      } catch {
        /* Durable queue survives delivery failures. */
      }
    });
    return NextResponse.redirect(
      paymentOrigin() + "/odeme/sonuc?attempt=" + id,
      303,
    );
  } catch {
    return new Response("RESULT_NOT_VERIFIED", { status: 503 });
  }
}
