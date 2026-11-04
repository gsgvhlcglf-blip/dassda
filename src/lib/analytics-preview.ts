import {
  analyticsEventSchema,
  summarizeAnalytics,
  analyticsHeatmap,
  type AnalyticsEvent,
  type AnalyticsSettings,
  type StoredAnalyticsEvent,
} from "./analytics";
export const analyticsPreviewKey =
  "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1.analytics-test";
export function readPreviewAnalytics() {
  try {
    const value = JSON.parse(
      localStorage.getItem(analyticsPreviewKey) || "null",
    );
    const events = Array.isArray(value?.events)
      ? (value.events as StoredAnalyticsEvent[])
          .filter(
            (e: StoredAnalyticsEvent) =>
              analyticsEventSchema.safeParse(
                Object.fromEntries(
                  Object.entries(e).filter(([key]) => key !== "created_at"),
                ),
              ).success &&
              typeof e.created_at === "string" &&
              Date.parse(e.created_at) >= Date.now() - 30 * 86400000,
          )
          .slice(-2500)
      : [];
    return { enabled: value?.enabled === true, events };
  } catch {
    return { enabled: false, events: [] as StoredAnalyticsEvent[] };
  }
}
function save(value: ReturnType<typeof readPreviewAnalytics>) {
  localStorage.setItem(analyticsPreviewKey, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("kz-preview-analytics"));
}
export function appendPreviewAnalytics(event: AnalyticsEvent) {
  const value = readPreviewAnalytics();
  if (!value.enabled) return;
  const valid = analyticsEventSchema.parse(event);
  if (value.events.some((e) => e.id === valid.id)) return;
  value.events.push({ ...valid, created_at: new Date().toISOString() });
  value.events = value.events.slice(-2500);
  save(value);
}
export const previewAnalyticsSource = {
  async report(days: number) {
    const value = readPreviewAnalytics();
    return {
      settings: {
        enabled: value.enabled,
        retentionDays: 30,
      } as AnalyticsSettings,
      report: summarizeAnalytics(value.events, days),
      storage: "preview" as const,
    };
  },
  async heatmap(
    days: number,
    path: string,
    width?: number,
    height?: number,
    revision?: string,
  ) {
    return analyticsHeatmap(
      readPreviewAnalytics().events,
      days,
      path,
      width,
      height,
      revision,
    );
  },
  async settings(value: AnalyticsSettings) {
    const old = readPreviewAnalytics();
    save({ ...old, enabled: value.enabled });
  },
  async clear() {
    const old = readPreviewAnalytics();
    save({ ...old, events: [] });
  },
};
