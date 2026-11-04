import { NextResponse } from "next/server";
import { getPaymentSettings } from "@/lib/payments/store";
import { paymentReadiness } from "@/lib/payments/config";
import { isLive } from "@/lib/database";
export async function GET() {
  try {
    const settings = await getPaymentSettings();
    return NextResponse.json(
      {
        ...settings,
        ready: settings.enabled && paymentReadiness(settings, isLive).ready,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { provider: "none", mode: "test", enabled: false, ready: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
