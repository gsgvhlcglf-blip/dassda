import { NextResponse } from "next/server";
import { getAnalyticsSettings } from "@/lib/analytics-store";
export async function GET() {
  try {
    return NextResponse.json(await getAnalyticsSettings(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { enabled: false, retentionDays: 30 },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
