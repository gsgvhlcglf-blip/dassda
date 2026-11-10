import type { StoredAnalyticsEvent } from "./analytics";
import { analyticsDevice } from "./analytics-funnel";
export type PurchaseReport = {
  counts: number[];
  byDevice: { device: string; counts: number[] }[];
  orders?: { created: number; paid: number; revenue: number };
};
export function summarizePurchase(
  events: StoredAnalyticsEvent[],
): PurchaseReport {
  const sessions = new Map<string, StoredAnalyticsEvent[]>();
  for (const event of events) {
    const rows = sessions.get(event.session_id) || [];
    rows.push(event);
    sessions.set(event.session_id, rows);
  }
  const counts = [0, 0, 0],
    byDevice = ["Mobil", "Tablet", "Masaüstü"].map((device) => ({
      device,
      counts: [0, 0, 0],
    }));
  for (const rows of sessions.values()) {
    rows.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    let reached = -1,
      device = "";
    for (const event of rows) {
      const step =
        event.kind === "pageview" &&
        /^\/urunler\/[a-zA-Z0-9_-]+$/.test(event.path)
          ? 0
          : event.kind === "cart_add"
            ? 1
            : event.kind === "checkout_start"
              ? 2
              : -1;
      if (step !== reached + 1 || step < 0) continue;
      if (step === 0) device = analyticsDevice(event.viewport_width);
      counts[step]++;
      byDevice.find((d) => d.device === device)!.counts[step]++;
      reached++;
    }
  }
  return { counts, byDevice };
}
