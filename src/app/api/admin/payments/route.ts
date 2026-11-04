import { NextResponse } from "next/server";
import { z } from "zod";
import { getRole, sameOrigin } from "@/lib/auth";
import { getPaymentSettings, setPaymentSettings } from "@/lib/payments/store";
import { paymentOrigin, paymentReadiness } from "@/lib/payments/config";
import { isLive } from "@/lib/database";
async function status() {
  const settings = await getPaymentSettings();
  return {
    settings,
    ...paymentReadiness(settings, isLive),
    origin: paymentOrigin(),
    callbacks: {
      paytr: paymentOrigin()
        ? paymentOrigin() + "/api/payments/paytr/callback"
        : null,
      iyzico: paymentOrigin()
        ? paymentOrigin() + "/api/payments/iyzico/callback"
        : null,
    },
  };
}
export async function GET() {
  if ((await getRole()) !== "admin")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    return NextResponse.json(await status(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Ödeme yapılandırması yüklenemedi. 006_payments.sql kurulumu gerekebilir.",
      },
      { status: 503 },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req) || (await getRole()) !== "admin")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    const value = z
      .object({
        provider: z.enum(["none", "paytr", "iyzico"]),
        mode: z.enum(["test", "live"]),
        enabled: z.boolean(),
      })
      .strict()
      .parse(await req.json());
    const ready = paymentReadiness(value, isLive);
    if (value.enabled && !ready.ready)
      return NextResponse.json(
        { error: "Ödeme açılamadı. Eksikler: " + ready.missing.join(", ") },
        { status: 400 },
      );
    await setPaymentSettings(value);
    return NextResponse.json(await status(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Ödeme ayarları kaydedilemedi." },
      { status: 400 },
    );
  }
}
