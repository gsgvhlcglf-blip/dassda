import { NextResponse } from "next/server";
import { z } from "zod";
import { analyticsEventSchema } from "@/lib/analytics";
import {
  appendAnalyticsEvents,
  getAnalyticsSettings,
} from "@/lib/analytics-store";
import { sameOrigin, rateLimit } from "@/lib/auth";
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!rateLimit("analytics:" + req.headers.get("x-forwarded-for"), 120))
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  try {
    const body = await req.text();
    if (body.length > 20000)
      return NextResponse.json({ error: "TOO_LARGE" }, { status: 413 });
    const input = z
      .object({
        consent: z.literal(true),
        events: z.array(analyticsEventSchema).min(1).max(30),
      })
      .strict()
      .parse(JSON.parse(body));
    if (!(await getAnalyticsSettings()).enabled)
      return NextResponse.json(
        { error: "ANALYTICS_DISABLED" },
        { status: 403 },
      );
    await appendAnalyticsEvents(input.events);
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "ANALYTICS_EVENT_REJECTED" },
      { status: 400 },
    );
  }
}
