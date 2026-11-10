import { summarizePurchase, type PurchaseReport } from "./purchase-funnel";
import { summarizeFunnel, type FunnelReport } from "./analytics-funnel";
import { z } from "zod";
const publicPath =
  /^\/(?:|motosikletler(?:\/[a-zA-Z0-9_-]{1,120}){0,3}|urunler(?:\/[a-zA-Z0-9_-]{1,120})?|blog(?:\/[a-zA-Z0-9_-]{1,120})?|hakkimizda|iletisim|sss|teslimat-iade|gizlilik|kosullar|kargo-takip)$/;
export function analyticsPath(value: string) {
  try {
    const path = new URL(value, "https://preview.invalid").pathname;
    return publicPath.test(path) ? path : null;
  } catch {
    return null;
  }
}
export const analyticsEventSchema = z
  .object({
    id: z.uuid(),
    session_id: z.uuid(),
    kind: z.enum(["pageview", "click", "scroll", "cart_add", "checkout_start"]),
    path: z.union([z.string().max(400).regex(publicPath), z.literal("/odeme")]),
    viewport_width: z.number().int().min(240).max(7680),
    viewport_height: z.number().int().min(200).max(4320),
    document_width: z.number().int().min(240).max(16384),
    document_height: z.number().int().min(200).max(100000),
    x: z.number().min(0).max(1).nullable(),
    y: z.number().min(0).max(1).nullable(),
    depth: z.number().min(0).max(1).nullable(),
    referrer_host: z
      .string()
      .max(253)
      .regex(/^(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]*$/),
    revision: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z0-9_-]+$/),
  })
  .strict()
  .refine(
    (e) =>
      (e.kind === "checkout_start") === (e.path === "/odeme") &&
      (e.kind !== "checkout_start" ||
        (e.depth === null && e.referrer_host === "")),
  )
  .refine(
    (e) => e.kind !== "cart_add" || /^\/urunler\/[a-zA-Z0-9_-]+$/.test(e.path),
  )
  .refine((e) =>
    e.kind === "click"
      ? e.x !== null && e.y !== null
      : e.x === null && e.y === null,
  );
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export type StoredAnalyticsEvent = AnalyticsEvent & { created_at: string };
export type AnalyticsSettings = { enabled: boolean; retentionDays: number };
export type AnalyticsReport = {
  funnel?: FunnelReport;
  purchase?: PurchaseReport;
  totals: {
    sessions: number;
    pageviews: number;
    clicks: number;
    averageDepth: number;
  };
  daily: { date: string; views: number; sessions: number; clicks: number }[];
  pages: {
    path: string;
    views: number;
    sessions: number;
    clicks: number;
    averageDepth: number;
  }[];
  devices: { device: string; views: number }[];
  sources: { host: string; views: number }[];
};
export type HeatPoint = { x: number; y: number; count: number };
export type HeatmapReport = {
  screens: {
    width: number;
    height: number;
    revision: string;
    clicks: number;
  }[];
  points: HeatPoint[];
  total: number;
};
const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const dayKey = (date: Date | string) =>
  dateFormatter.format(new Date(date));
export function analyticsSince(days: number, now = Date.now()) {
  return (
    new Date(dayKey(new Date(now)) + "T00:00:00+03:00").getTime() -
    (days - 1) * 86400000
  );
}
export function summarizeAnalytics(
  events: StoredAnalyticsEvent[],
  days: number,
  now = Date.now(),
): AnalyticsReport {
  const since = analyticsSince(days, now);
  const rows = events.filter(
      (e) =>
        Date.parse(e.created_at) >= since && Date.parse(e.created_at) <= now,
    ),
    views = rows.filter((e) => e.kind === "pageview"),
    clicks = rows.filter((e) => e.kind === "click");
  const depths = new Map<string, number>();
  for (const e of rows)
    if (e.depth !== null)
      depths.set(
        e.session_id + "|" + e.path,
        Math.max(depths.get(e.session_id + "|" + e.path) || 0, e.depth),
      );
  const average = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const pages = [
    ...new Set(rows.filter((e) => analyticsPath(e.path)).map((e) => e.path)),
  ]
    .map((path) => {
      const p = rows.filter((e) => e.path === path);
      return {
        path,
        views: p.filter((e) => e.kind === "pageview").length,
        sessions: new Set(
          p.filter((e) => e.kind === "pageview").map((e) => e.session_id),
        ).size,
        clicks: p.filter((e) => e.kind === "click").length,
        averageDepth: average(
          [...depths]
            .filter(([key]) => key.endsWith("|" + path))
            .map(([, v]) => v),
        ),
      };
    })
    .sort((a, b) => b.views - a.views || b.clicks - a.clicks)
    .slice(0, 50);
  const rowsByDay = new Map<string, StoredAnalyticsEvent[]>();
  for (const row of rows) {
    const key = dayKey(row.created_at);
    const group = rowsByDay.get(key) || [];
    group.push(row);
    rowsByDay.set(key, group);
  }
  const daily = Array.from({ length: days }, (_, i) => {
    const date = dayKey(new Date(since + i * 86400000 + 43200000)),
      r = rowsByDay.get(date) || [];
    return {
      date,
      views: r.filter((e) => e.kind === "pageview").length,
      sessions: new Set(
        r.filter((e) => e.kind === "pageview").map((e) => e.session_id),
      ).size,
      clicks: r.filter((e) => e.kind === "click").length,
    };
  });
  const group = (key: (e: StoredAnalyticsEvent) => string) => {
    const counts = new Map<string, number>();
    for (const e of views) counts.set(key(e), (counts.get(key(e)) || 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  };
  return {
    funnel: summarizeFunnel(rows),
    purchase: summarizePurchase(rows),
    totals: {
      sessions: new Set(views.map((e) => e.session_id)).size,
      pageviews: views.length,
      clicks: clicks.length,
      averageDepth: average([...depths.values()]),
    },
    daily,
    pages,
    devices: group((e) =>
      e.viewport_width < 768
        ? "Mobil"
        : e.viewport_width < 1100
          ? "Tablet"
          : "Masaüstü",
    ).map(([device, views]) => ({ device, views })),
    sources: group((e) => e.referrer_host || "Doğrudan")
      .map(([host, views]) => ({ host, views }))
      .slice(0, 20),
  };
}
export function analyticsHeatmap(
  events: StoredAnalyticsEvent[],
  days: number,
  path: string,
  width?: number,
  height?: number,
  revision?: string,
  now = Date.now(),
): HeatmapReport {
  const since = analyticsSince(days, now);
  const rows = events.filter(
      (e) =>
        e.kind === "click" &&
        e.path === path &&
        Date.parse(e.created_at) >= since &&
        Date.parse(e.created_at) <= now,
    ),
    screens = new Map<
      string,
      { width: number; height: number; revision: string; clicks: number }
    >();
  for (const e of rows) {
    const key = e.viewport_width + "x" + e.viewport_height + "|" + e.revision,
      old = screens.get(key);
    screens.set(key, {
      width: e.viewport_width,
      height: e.viewport_height,
      revision: e.revision,
      clicks: (old?.clicks || 0) + 1,
    });
  }
  const chosen = rows.filter(
      (e) =>
        (width === undefined || e.viewport_width === width) &&
        (height === undefined || e.viewport_height === height) &&
        (revision === undefined || e.revision === revision),
    ),
    cells = new Map<string, HeatPoint>();
  for (const e of chosen) {
    const ix = Math.min(39, Math.floor(e.x! * 40)),
      iy = Math.min(99, Math.floor(e.y! * 100)),
      key = ix + "," + iy,
      old = cells.get(key);
    cells.set(key, {
      x: (ix + 0.5) / 40,
      y: (iy + 0.5) / 100,
      count: (old?.count || 0) + 1,
    });
  }
  return {
    screens: [...screens.values()]
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 100),
    points: [...cells.values()],
    total: chosen.length,
  };
}
