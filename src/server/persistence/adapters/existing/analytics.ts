import "server-only";
import { isLive, localDB } from "@/lib/database";
import { supabase } from "@/lib/supabase";
import {
  summarizeAnalytics,
  analyticsHeatmap,
  type AnalyticsEvent,
  type AnalyticsSettings,
  type StoredAnalyticsEvent,
} from "@/lib/analytics";
export async function getAnalyticsSettings(): Promise<AnalyticsSettings> {
  if (isLive) {
    const { data, error } = await (
      await supabase()
    ).rpc("analytics_public_settings");
    if (error) throw Error("ANALYTICS_SETUP_REQUIRED");
    return data;
  }
  const row = localDB()
    .prepare(
      "SELECT enabled,retention_days FROM analytics_settings WHERE id='site'",
    )
    .get() as { enabled: number; retention_days: number };
  return { enabled: !!row.enabled, retentionDays: row.retention_days };
}
export async function setAnalyticsSettings(settings: AnalyticsSettings) {
  if (isLive) {
    const { error } = await (
      await supabase()
    )
      .from("analytics_settings")
      .upsert({
        id: "site",
        enabled: settings.enabled,
        retention_days: settings.retentionDays,
      });
    if (error) throw error;
  } else
    localDB()
      .prepare(
        "UPDATE analytics_settings SET enabled=?,retention_days=? WHERE id='site'",
      )
      .run(Number(settings.enabled), settings.retentionDays);
}
export async function appendAnalyticsEvents(events: AnalyticsEvent[]) {
  if (isLive) {
    const { error } = await (
      await supabase()
    ).rpc("append_analytics_events", { input: { consent: true, events } });
    if (error) throw error;
    return;
  }
  const db = localDB(),
    settings = await getAnalyticsSettings();
  if (!settings.enabled) throw Error("ANALYTICS_DISABLED");
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM analytics_events WHERE created_at<?").run(
      new Date(Date.now() - settings.retentionDays * 86400000).toISOString(),
    );
    const statement = db.prepare(
      "INSERT OR IGNORE INTO analytics_events(id,session_id,kind,path,viewport_width,viewport_height,document_width,document_height,x,y,depth,referrer_host,revision,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    );
    for (const e of events) {
      const count = db
        .prepare(
          "SELECT count(*) as n FROM analytics_events WHERE session_id=? AND created_at>?",
        )
        .get(e.session_id, new Date(Date.now() - 86400000).toISOString()) as {
        n: number;
      };
      if (count.n >= 2000) throw Error("RATE_LIMITED");
      statement.run(
        e.id,
        e.session_id,
        e.kind,
        e.path,
        e.viewport_width,
        e.viewport_height,
        e.document_width,
        e.document_height,
        e.x,
        e.y,
        e.depth,
        e.referrer_host,
        e.revision,
        new Date().toISOString(),
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
async function localEvents(days: number) {
  const settings = await getAnalyticsSettings();
  localDB()
    .prepare("DELETE FROM analytics_events WHERE created_at<?")
    .run(
      new Date(Date.now() - settings.retentionDays * 86400000).toISOString(),
    );
  return localDB()
    .prepare("SELECT * FROM analytics_events WHERE created_at>=?")
    .all(
      new Date(Date.now() - (days + 1) * 86400000).toISOString(),
    ) as unknown as StoredAnalyticsEvent[];
}
export async function getAnalyticsReport(days: number) {
  if (!isLive) return summarizeAnalytics(await localEvents(days), days);
  const { data, error } = await (
    await supabase()
  ).rpc("admin_analytics_summary", { requested_days: days });
  if (error) throw Error("ANALYTICS_SETUP_REQUIRED");
  const funnel = await (
    await supabase()
  ).rpc("admin_analytics_funnel", { requested_days: days });
  if (funnel.error) throw Error("ANALYTICS_FUNNEL_SETUP_REQUIRED");
  return { ...data, funnel: funnel.data };
}
export async function getAnalyticsHeatmap(
  days: number,
  path: string,
  width?: number,
  height?: number,
  revision?: string,
) {
  if (!isLive)
    return analyticsHeatmap(
      await localEvents(days),
      days,
      path,
      width,
      height,
      revision,
    );
  const { data, error } = await (
    await supabase()
  ).rpc("admin_analytics_heatmap", {
    requested_days: days,
    selected_path: path,
    selected_width: width ?? null,
    selected_height: height ?? null,
    selected_revision: revision ?? null,
  });
  if (error) throw Error("ANALYTICS_SETUP_REQUIRED");
  return data;
}
export async function clearAnalyticsEvents() {
  if (!isLive) localDB().exec("DELETE FROM analytics_events");
  else {
    const { error } = await (await supabase()).rpc("clear_analytics_events");
    if (error) throw error;
  }
}
