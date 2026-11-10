import { NextResponse } from "next/server";
import { z } from "zod";
import { isIP } from "node:net";
import { sameOrigin, rateLimit } from "@/lib/auth";
import { getCustomer } from "@/lib/customer";
import { isLive } from "@/lib/database";
import {
  getPaymentSettings,
  expirePayments,
  preparePayment,
  paymentOrder,
  readyPayment,
  initializationFailed,
  findPayment,
} from "@/lib/payments/store";
import {
  paymentReadiness,
  paymentCredentials,
  paymentOrigin,
} from "@/lib/payments/config";
import { initializeGateway, GatewayError } from "@/lib/payments/providers";
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const customer = await getCustomer();
  if (!customer)
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!rateLimit("payment-start:" + customer.id, 10))
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  let createdId: string | undefined;
  try {
    const body = await req.text();
    if (body.length > 4000) throw Error("INVALID_INPUT");
    const input = z
      .object({
        expectedProvider: z.enum(["paytr", "iyzico"]),
        expectedMode: z.enum(["test", "live"]),
        reference: z
          .string()
          .regex(/^(?:KZ-?[a-zA-Z0-9-]{4,64}|#[0-9]{6}[1-9][0-9]{0,15})$/),
        city: z.string().trim().min(2).max(100).optional(),
        country: z.string().trim().min(2).max(100).optional(),
        identity: z
          .string()
          .trim()
          .min(5)
          .max(32)
          .regex(/^[a-zA-Z0-9]+$/)
          .optional(),
      })
      .strict()
      .parse(JSON.parse(body));
    const settings = await getPaymentSettings();
    if (!settings.enabled || !paymentReadiness(settings, isLive).ready)
      return NextResponse.json(
        { error: "PAYMENTS_UNAVAILABLE" },
        { status: 503 },
      );
    if (
      settings.provider === "iyzico" &&
      (!input.city || !input.country || !input.identity)
    )
      return NextResponse.json(
        { error: "BUYER_DETAILS_REQUIRED" },
        { status: 400 },
      );
    const ip = (
      req.headers.get("x-vercel-forwarded-for") ||
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      ""
    )
      .split(",")[0]
      .trim();
    if (!isIP(ip))
      return NextResponse.json(
        { error: "BUYER_IP_UNAVAILABLE" },
        { status: 503 },
      );
    await expirePayments();
    const a = await preparePayment(input.reference, customer.id, {
      provider: input.expectedProvider,
      mode: input.expectedMode,
    });
    if (a.created) {
      createdId = a.id;
      const session = await initializeGateway(
        a,
        await paymentOrder(a),
        {
          ip,
          city: input.city,
          country: input.country,
          identity: input.identity,
        },
        paymentOrigin()!,
        paymentCredentials(a.provider, a.mode),
      );
      await readyPayment(a.id, session.token, session.url);
    }
    const current = await findPayment(a.id);
    return NextResponse.json(
      {
        id: a.id,
        state: current!.state,
        provider: a.provider,
        mode: a.mode,
        checkoutUrl: current!.state === "ready" ? current!.checkout_url : null,
      },
      {
        status: current!.state === "creating" ? 202 : 200,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    if (createdId)
      await initializationFailed(
        createdId,
        error instanceof GatewayError ? error.ambiguous : true,
      ).catch(() => {});
    const message = error instanceof Error ? error.message : "";
    const known = [
      "OUT_OF_STOCK",
      "ORDER_EXPIRED",
      "DEMO_PAYMENT_BLOCKED",
      "BUYER_DETAILS_REQUIRED",
      "AUTH_REQUIRED",
      "PAYMENT_CONFIGURATION_CHANGED",
    ];
    return NextResponse.json(
      {
        error: known.includes(message)
          ? message
          : createdId
            ? "PAYMENT_INITIALIZATION_FAILED"
            : "PAYMENT_START_FAILED",
      },
      { status: message === "AUTH_REQUIRED" ? 403 : 400 },
    );
  }
}
