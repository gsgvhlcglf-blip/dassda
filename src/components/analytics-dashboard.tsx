"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  AnalyticsReport,
  AnalyticsSettings,
  HeatmapReport,
  HeatPoint,
} from "@/lib/analytics";
export type AnalyticsSource = {
  report: (
    days: number,
  ) => Promise<{
    settings: AnalyticsSettings;
    report: AnalyticsReport;
    storage: string;
  }>;
  heatmap: (
    days: number,
    path: string,
    width?: number,
    height?: number,
    revision?: string,
  ) => Promise<HeatmapReport>;
  settings: (value: AnalyticsSettings) => Promise<void>;
  clear: () => Promise<void>;
};
export type HeatmapSelection = {
  path: string;
  width: number;
  height: number;
  revision: string;
  points: HeatPoint[];
  opacity: number;
};
async function json(url: string, options?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Analitik verisi yüklenemedi.");
  return data;
}
const liveSource: AnalyticsSource = {
  report: (days) => json("/api/admin/analytics?days=" + days),
  heatmap: (days, path, width, height, revision) =>
    json(
      "/api/admin/analytics?" +
        new URLSearchParams({
          days: String(days),
          path,
          ...(width
            ? {
                width: String(width),
                height: String(height),
                revision: revision || "",
              }
            : {}),
        }),
    ),
  settings: (value) =>
    json("/api/admin/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settings", ...value }),
    }),
  clear: () =>
    json("/api/admin/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear" }),
    }),
};
export function AnalyticsDashboard({
  source = liveSource,
  preview = false,
  renderFrame,
  onOpenCustomer,
}: {
  source?: AnalyticsSource;
  preview?: boolean;
  renderFrame?: (selection: HeatmapSelection) => ReactNode;
  onOpenCustomer?: () => void;
}) {
  const [days, setDays] = useState(7),
    [data, setData] = useState<Awaited<
      ReturnType<AnalyticsSource["report"]>
    > | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [path, setPath] = useState("/"),
    [heatmap, setHeatmap] = useState<HeatmapReport | null>(null),
    [screen, setScreen] = useState(""),
    [opacity, setOpacity] = useState(0.7);
  const refresh = async () => {
    try {
      setError("");
      setData(await source.report(days));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Veri yüklenemedi.");
    }
  };
  useEffect(() => {
    void refresh();
    const listener = () => void refresh();
    window.addEventListener("storage", listener);
    window.addEventListener("kz-preview-analytics", listener);
    const timer = setInterval(listener, preview ? 3000 : 30000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", listener);
      window.removeEventListener("kz-preview-analytics", listener);
    };
  }, [days, source, preview]);
  useEffect(() => {
    let valid = true;
    const parts = screen.split("|"),
      dimension = parts[0]?.split("x");
    source
      .heatmap(
        days,
        path,
        screen ? Number(dimension[0]) : undefined,
        screen ? Number(dimension[1]) : undefined,
        screen ? parts[1] : undefined,
      )
      .then((result) => {
        if (!valid) return;
        setHeatmap(result);
        if (!screen && result.screens.length) {
          const first = result.screens[0];
          setScreen(first.width + "x" + first.height + "|" + first.revision);
        }
      })
      .catch((error) => {
        if (valid) setError(error.message);
      });
    return () => {
      valid = false;
    };
  }, [days, path, screen, data, source]);
  const changePath = (value: string) => {
    setPath(value);
    setScreen("");
  };
  async function settings(
    enabled: boolean,
    retentionDays = data?.settings.retentionDays || 30,
  ) {
    setBusy(true);
    try {
      await source.settings({ enabled, retentionDays });
      await refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ayar kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }
  async function clear() {
    if (!confirm("Bu analitik kayıtları silinsin mi? Bu işlem geri alınamaz."))
      return;
    setBusy(true);
    try {
      await source.clear();
      setScreen("");
      await refresh();
    } catch {
      setError("Kayıtlar silinemedi.");
    } finally {
      setBusy(false);
    }
  }
  function download() {
    const blob = new Blob(
        [
          JSON.stringify(
            {
              type: preview ? "kuzmin-test-analytics" : "kuzmin-site-analytics",
              exportedAt: new Date().toISOString(),
              days,
              report: data?.report,
              heatmap: { path, screen, ...heatmap },
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download =
      "KUZMIN-Analitik-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const stats = data?.report.totals,
    percent = (value: number) => Math.round(value * 100) + "%",
    dimensions = screen.split("|")[0]?.split("x"),
    selection: HeatmapSelection = {
      path,
      width: Number(dimensions?.[0]) || 1280,
      height: Number(dimensions?.[1]) || 900,
      revision: screen.split("|")[1] || "",
      points: heatmap?.points || [],
      opacity,
    };
  const paths = [
      ...new Set(["/", ...(data?.report.pages.map((p) => p.path) || []), path]),
    ],
    max = Math.max(1, ...(data?.report.daily.map((d) => d.views) || []));
  return (
    <div className="analytics-dashboard" data-analytics-dashboard>
      <header className="analytics-intro">
        <div>
          <p className="eyebrow">
            {preview
              ? "BU TARAYICI / TEST VERİSİ"
              : data?.storage === "local"
                ? "YEREL UYGULAMA"
                : "SİTE VERİSİ"}
          </p>
          <h2>Analitik & Isı Haritası</h2>
          <p>
            {preview
              ? "Yalnızca bu tarayıcıdaki müşteri önizlemesi ölçülür. Gerçek ziyaretçi istatistiği değildir."
              : "İzin veren oturumların sayfa görüntülemeleri, tıklamaları ve kaydırma oranları."}
          </p>
        </div>
        <label>
          Dönem
          <select
            aria-label="Analitik dönemi"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[7, 30, 90].map((value) => (
              <option key={value} value={value}>
                Son {value} gün
              </option>
            ))}
          </select>
        </label>
      </header>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <section className="analytics-controls">
        <div>
          <strong>
            {data?.settings.enabled ? "Kayıt açık" : "Kayıt kapalı"}
          </strong>
          <p>
            {preview
              ? "Kaydı açtıktan sonra müşteri önizlemesindeki test kaydı düğmesini kullanın. En fazla son 2.500 test olayı bu tarayıcıda saklanır."
              : "Kayıt, ziyaretçinin istatistik izni sonrasında başlar. Form içerikleri, hesap ve ödeme sayfaları kaydedilmez."}
          </p>
        </div>
        <button
          className="button"
          disabled={busy || !data}
          onClick={() => settings(!data?.settings.enabled)}
        >
          {data?.settings.enabled
            ? "Kaydı kapat"
            : preview
              ? "Test kaydını aç"
              : "Kaydı aç"}
        </button>
        {preview ? (
          <button className="button outline" onClick={onOpenCustomer}>
            Müşteri önizlemesini aç ↗
          </button>
        ) : (
          <label>
            Saklama süresi
            <select
              aria-label="Analitik saklama süresi"
              value={data?.settings.retentionDays || 30}
              disabled={busy || !data}
              onChange={(e) =>
                settings(
                  data?.settings.enabled || false,
                  Number(e.target.value),
                )
              }
            >
              {[7, 30, 90].map((days) => (
                <option key={days} value={days}>
                  {days} gün
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
      <div className="analytics-stats">
        {[
          ["Oturum", stats?.sessions || 0],
          ["Sayfa görüntüleme", stats?.pageviews || 0],
          ["Tıklamalar", stats?.clicks || 0],
          ["Ort. kaydırma", percent(stats?.averageDepth || 0)],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong data-stat={label}>{value}</strong>
          </div>
        ))}
      </div>
      <section className="analytics-card">
        <div className="analytics-card-title">
          <h3>Günlük sayfa görüntülemeleri</h3>
          <span>Türkiye saati · Oturum, tekil kişi sayısı değildir.</span>
        </div>
        {stats?.pageviews ? (
          <div className="analytics-chart">
            {data?.report.daily.map((day) => (
              <div
                key={day.date}
                className="analytics-bar"
                title={day.date + ": " + day.views + " görüntüleme"}
              >
                <span
                  style={{ height: Math.max(2, (day.views / max) * 120) }}
                />
                <small>{day.date.slice(5)}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="analytics-empty">
            Henüz kaydedilmiş sayfa görüntülemesi yok.
          </p>
        )}
      </section>
      <div className="analytics-two">
        <section className="analytics-card">
          <h3>Sayfalar</h3>
          <div className="analytics-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sayfa</th>
                  <th>Görüntüleme</th>
                  <th>Tıklama</th>
                  <th>Kaydırma</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data?.report.pages.map((row) => (
                  <tr key={row.path}>
                    <td>{row.path}</td>
                    <td>{row.views}</td>
                    <td>{row.clicks}</td>
                    <td>{percent(row.averageDepth)}</td>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => changePath(row.path)}
                      >
                        Haritada göster
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data?.report.pages.length && (
            <p className="analytics-empty">Henüz sayfa kaydı yok.</p>
          )}
          <small>En çok görüntülenen ilk 50 sayfa.</small>
        </section>
        <section className="analytics-card">
          <h3>Cihazlar / Kaynaklar</h3>
          {data?.report.devices.map((row) => (
            <p className="analytics-split" key={row.device}>
              <span>{row.device}</span>
              <strong>{row.views}</strong>
            </p>
          ))}
          <hr />
          {data?.report.sources.map((row) => (
            <p className="analytics-split" key={row.host}>
              <span>{row.host}</span>
              <strong>{row.views}</strong>
            </p>
          ))}
          {!data?.report.sources.length && (
            <p className="analytics-empty">Henüz kaynak verisi yok.</p>
          )}
        </section>
      </div>
      <section className="analytics-card analytics-heatmap-section">
        <h3>Tıklama ısı haritası</h3>
        <div className="analytics-map-controls">
          <label>
            Sayfa
            <select
              aria-label="Isı haritası sayfası"
              value={path}
              onChange={(e) => changePath(e.target.value)}
            >
              {paths.map((path) => (
                <option key={path} value={path}>
                  {path}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ekran / Tasarım sürümü
            <select
              aria-label="Isı haritası ekranı"
              value={screen}
              onChange={(e) => setScreen(e.target.value)}
            >
              <option value="">Kayıtlı ekran ölçüsü seçin</option>
              {heatmap?.screens.map((s) => (
                <option
                  key={s.width + "x" + s.height + "|" + s.revision}
                  value={s.width + "x" + s.height + "|" + s.revision}
                >
                  {s.width} × {s.height} · {s.revision} · {s.clicks} tıklama
                </option>
              ))}
            </select>
          </label>
          <label>
            Katman yoğunluğu
            <input
              aria-label="Isı haritası saydamlığı"
              type="range"
              min="20"
              max="100"
              value={opacity * 100}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
            />
          </label>
        </div>
        <p className="analytics-map-note">
          {heatmap?.total || 0} tıklama · Seçilen ekran ölçüsüne göre
          gösterilir. Sayfanın mevcut tasarımı kullanılır; eski tasarımlardaki
          konumlar farklılaşabilir.
        </p>
        {!heatmap?.total && (
          <p className="analytics-empty">
            Bu seçim için henüz tıklama kaydı yok.
          </p>
        )}
        <div className="analytics-legend">
          <span>Düşük</span>
          <i />
          <span>Yüksek</span>
        </div>
        {renderFrame ? (
          renderFrame(selection)
        ) : (
          <LiveAnalyticsFrame selection={selection} />
        )}
      </section>
      <div className="analytics-actions">
        <button className="button outline" onClick={() => void refresh()}>
          Yenile
        </button>
        <button className="button outline" disabled={!data} onClick={download}>
          Veriyi indir
        </button>
        <button className="text-link" disabled={busy} onClick={clear}>
          Kayıtları sil
        </button>
      </div>
    </div>
  );
}
export function LiveAnalyticsFrame({
  selection,
}: {
  selection: HeatmapSelection;
}) {
  const frame = useRef<HTMLIFrameElement>(null),
    box = useRef<HTMLDivElement>(null),
    [available, setAvailable] = useState(900);
  useEffect(() => {
    const observer = new ResizeObserver(() =>
      setAvailable(box.current?.clientWidth || 900),
    );
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, []);
  const send = () =>
    frame.current?.contentWindow?.postMessage(
      {
        type: "kz-analytics-points",
        points: selection.points,
        opacity: selection.opacity,
      },
      location.origin,
    );
  useEffect(() => {
    send();
    const receive = (event: MessageEvent) => {
      if (
        event.source === frame.current?.contentWindow &&
        event.data?.type === "kz-analytics-map-ready"
      )
        send();
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [selection]);
  const scale = Math.min(1, available / selection.width);
  return (
    <div ref={box} className="analytics-frame-box">
      <div
        style={{
          width: selection.width * scale,
          height: selection.height * scale,
          margin: "auto",
        }}
      >
        <iframe
          ref={frame}
          title="Isı haritası sayfa önizlemesi"
          src={"/analitik-onizleme?path=" + encodeURIComponent(selection.path)}
          onLoad={send}
          style={{
            width: selection.width,
            height: selection.height,
            transform: "scale(" + scale + ")",
            transformOrigin: "top left",
            border: 0,
          }}
        />
      </div>
    </div>
  );
}
