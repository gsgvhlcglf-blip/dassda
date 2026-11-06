"use client";
import { useEffect, useState } from "react";
import { money } from "@/lib/i18n";
import type { RequestInsights } from "@/lib/requests";

export function RequestInsightsView({ insight }: { insight: RequestInsights }) {
  const groups: [string, RequestInsights["byModel"]][] = [
    ["Marka dağılımı", insight.byBrand],
    ["En çok talep edilen modeller", insight.byModel],
    ["Karbon tercihleri", insight.byMaterial],
    ["Üretim yöntemleri", insight.byMethod],
    ["Talep edilen parçalar", insight.byPart],
    ["Aşama dağılımı", insight.byStatus],
    ["Başvuru kaynakları", insight.bySource],
  ];
  return (
    <section className="request-insights-view" data-request-insights>
      <div className="crm-stats">
        {(
          [
            ["Toplam başvuru", insight.total],
            ["Yeni başvuru", insight.new],
            ["Özel üretim", insight.custom],
            ["Yeni ürün talebi", insight.demand],
            ["Farklı iletişim kaydı", insight.customers],
            ["Teknik değerlendirme", insight.technical],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="crm-insights">
        {groups.map(([title, values]) => (
          <section className="crm-card" key={title}>
            <h3>{title}</h3>
            {values.slice(0, 10).map((v) => (
              <div className="crm-ranking" key={v.name}>
                <span>{v.name}</span>
                <strong>{v.count}</strong>
                <small>{v.customers} farklı iletişim kaydı</small>
              </div>
            ))}
            {!values.length && <p>Henüz veri yok.</p>}
          </section>
        ))}
      </div>
      <p className="muted">
        Son tekliflerin toplamı: {money(insight.quoteTotal)}. Bu tutar tahsilat
        veya ciro değildir. Sayılar kayıtlı başvurulardan hesaplanır; ziyaretçi
        istatistik izninden bağımsızdır.
      </p>
    </section>
  );
}

export type RequestAnalyticsSource = (
  days: number,
) => Promise<{ insights: RequestInsights; demo: boolean }>;
const liveSource: RequestAnalyticsSource = async (days) => {
  const response = await fetch(
    "/api/admin/requests?view=insights&days=" + days,
    { cache: "no-store" },
  );
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Talep analitiği yüklenemedi.");
  return data;
};

export function RequestAnalyticsPanel({
  days,
  source = liveSource,
  preview = false,
}: {
  days: number;
  source?: RequestAnalyticsSource;
  preview?: boolean;
}) {
  const [data, setData] = useState<Awaited<
    ReturnType<RequestAnalyticsSource>
  > | null>(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let active = true,
      pending = false;
    const refresh = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const next = await source(days);
        if (active) {
          setData(next);
          setError("");
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Talep analitiği yüklenemedi.",
          );
      } finally {
        pending = false;
      }
    };
    void refresh();
    const listener = () => void refresh();
    const timer = setInterval(listener, 15000);
    window.addEventListener("focus", listener);
    window.addEventListener("storage", listener);
    window.addEventListener("kz-requests-changed", listener);
    document.addEventListener("visibilitychange", listener);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", listener);
      window.removeEventListener("storage", listener);
      window.removeEventListener("kz-requests-changed", listener);
      document.removeEventListener("visibilitychange", listener);
    };
  }, [days, source, refreshKey]);
  useEffect(() => {
    setData(null);
  }, [days, source]);
  return (
    <section className="crm-analytics-panel" data-crm-analytics>
      <div className="crm-sync-bar">
        <div>
          <h3>Talep & CRM analitiği</h3>
          <p>
            {preview
              ? "Örnek CRM başvuruları · Gerçek müşteri verisi değildir."
              : "Talepler & CRM ile aynı başvuru kayıtları · 15 saniyede bir güncellenir."}
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => setRefreshKey((v) => v + 1)}
        >
          Talep verisini yenile
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error} Son başarılı veriler varsa gösterilmeye devam eder.
        </p>
      )}
      {data ? (
        <RequestInsightsView insight={data.insights} />
      ) : (
        <p role="status">
          {error
            ? "Talep verisi henüz yüklenemedi."
            : "Talep analitiği yükleniyor…"}
        </p>
      )}
    </section>
  );
}
