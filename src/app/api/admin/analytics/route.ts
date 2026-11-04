import { NextResponse } from "next/server";
import { z } from "zod";
import { getRole, sameOrigin } from "@/lib/auth";
import {
  getAnalyticsSettings,
  setAnalyticsSettings,
  getAnalyticsReport,
  getAnalyticsHeatmap,
  clearAnalyticsEvents,
} from "@/lib/analytics-store";
import { analyticsPath } from "@/lib/analytics";
import { isLive } from "@/lib/database";
export async function GET(req: Request) {
  if ((await getRole()) !== "admin")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    const url = new URL(req.url),
      days = z.coerce
        .number()
        .int()
        .min(1)
        .max(90)
        .parse(url.searchParams.get("days") || 7),
      path = url.searchParams.get("path");
    if (path) {
      if (!analyticsPath(path) || analyticsPath(path) !== path) throw Error();
      const dimension = (name: string) =>
        url.searchParams.has(name)
          ? z.coerce
              .number()
              .int()
              .min(200)
              .max(7680)
              .parse(url.searchParams.get(name))
          : undefined;
      const revision = url.searchParams.get("revision") || undefined;
      if (revision && !/^[a-zA-Z0-9_-]{1,64}$/.test(revision)) throw Error();
      return NextResponse.json(
        await getAnalyticsHeatmap(
          days,
          path,
          dimension("width"),
          dimension("height"),
          revision,
        ),
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return NextResponse.json(
      {
        settings: await getAnalyticsSettings(),
        report: await getAnalyticsReport(days),
        storage: isLive ? "supabase" : "local",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Analitik verisi yüklenemedi. Supabase için 003_analytics.sql kurulumu gerekebilir.",
      },
      { status: 503 },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if ((await getRole()) !== "admin")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    const value = await req.json();
    if (value.action === "clear") {
      await clearAnalyticsEvents();
      return NextResponse.json({ ok: true });
    }
    const input = z
      .object({
        action: z.literal("settings"),
        enabled: z.boolean(),
        retentionDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
      })
      .strict()
      .parse(value);
    await setAnalyticsSettings(input);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Ayarlar kaydedilemedi." },
      { status: 400 },
    );
  }
}
