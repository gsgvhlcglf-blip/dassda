import type { StoredAnalyticsEvent } from "./analytics";
export const funnelLabels = [
  "Marka seçimi açıldı",
  "Marka seçildi",
  "Model seçildi",
  "Uyumlu ürünler açıldı",
  "Ürün incelendi",
  "Sepete eklendi",
];
export type FunnelReport = {
  counts: number[];
  byDevice: { device: string; counts: number[] }[];
  directProductSessions: number;
};
export const analyticsDevice = (width: number) =>
  width < 768 ? "Mobil" : width < 1100 ? "Tablet" : "Masaüstü";
export function funnelStep(event: Pick<StoredAnalyticsEvent, "kind" | "path">) {
  if (event.kind === "cart_add")
    return /^\/urunler\/[a-zA-Z0-9_-]+$/.test(event.path) ? 5 : null;
  if (event.kind !== "pageview") return null;
  if (/^\/urunler\/[a-zA-Z0-9_-]+$/.test(event.path)) return 4;
  const parts = event.path.split("/").filter(Boolean);
  return parts[0] === "motosikletler" && parts.length <= 4
    ? parts.length - 1
    : null;
}
export function summarizeFunnel(events: StoredAnalyticsEvent[]): FunnelReport {
  const sessions = new Map<string, StoredAnalyticsEvent[]>();
  for (const event of events) {
    const list = sessions.get(event.session_id) || [];
    list.push(event);
    sessions.set(event.session_id, list);
  }
  const counts = Array(6).fill(0) as number[],
    byDevice = ["Mobil", "Tablet", "Masaüstü"].map((device) => ({
      device,
      counts: Array(6).fill(0) as number[],
    }));
  let directProductSessions = 0;
  for (const rows of sessions.values()) {
    rows.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    let reached = -1,
      device = "";
    const entry = rows.find((row) => funnelStep(row) === 0);
    if (!entry) {
      if (rows.some((row) => funnelStep(row) === 4)) directProductSessions++;
      continue;
    }
    device = analyticsDevice(entry.viewport_width);
    const group = byDevice.find((g) => g.device === device)!;
    for (const row of rows) {
      const step = funnelStep(row);
      if (step === reached + 1) {
        reached++;
        counts[reached]++;
        group.counts[reached]++;
      }
    }
  }
  return { counts, byDevice, directProductSessions };
}
