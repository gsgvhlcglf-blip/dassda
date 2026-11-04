"use client";
import { useEffect, useRef, useState } from "react";
import { analyticsPath, type AnalyticsEvent } from "@/lib/analytics";
import {
  createAnalyticsRecorder,
  privacyPreference,
} from "@/lib/analytics-recorder";
export function AnalyticsTracker({
  path,
  preview = false,
}: {
  path: string;
  preview?: boolean;
}) {
  const [enabled, setEnabled] = useState(false),
    [choice, setChoice] = useState<boolean | null>(null),
    [open, setOpen] = useState(false),
    queue = useRef<AnalyticsEvent[]>([]),
    allowed = useRef(false),
    sending = useRef(false);
  useEffect(() => {
    if (preview) return;
    try {
      const value = localStorage.getItem("kz.analytics.consent");
      setChoice(value === "yes" ? true : value === "no" ? false : null);
    } catch {}
    const syncConsent = (event: StorageEvent) => {
      if (event.key !== "kz.analytics.consent" && event.key !== null) return;
      // Stop and discard pending events before the recorder's effect cleans up.
      allowed.current = false;
      queue.current = [];
      setChoice(
        event.newValue === "yes"
          ? true
          : event.newValue === "no"
            ? false
            : null,
      );
    };
    window.addEventListener("storage", syncConsent);
    fetch("/api/analytics/settings", {
      cache: "no-store",
      referrerPolicy: "no-referrer",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((value) => setEnabled(value?.enabled === true))
      .catch(() => {});
    return () => window.removeEventListener("storage", syncConsent);
  }, [preview]);
  const flush = async () => {
    if (!allowed.current || sending.current || !queue.current.length) return;
    sending.current = true;
    const events = queue.current.splice(0, 30);
    try {
      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true, events }),
        keepalive: true,
        referrerPolicy: "no-referrer",
      });
      if (response.status >= 500) throw Error();
    } catch {
      if (allowed.current)
        queue.current = [...events, ...queue.current].slice(-120);
    } finally {
      sending.current = false;
    }
  };
  useEffect(() => {
    allowed.current =
      enabled && choice === true && !preview && !privacyPreference();
    if (!allowed.current || !analyticsPath(path)) return;
    const stop = createAnalyticsRecorder(
      path,
      process.env.NEXT_PUBLIC_ANALYTICS_REVISION || "site",
      (event) => {
        if (allowed.current)
          queue.current = [...queue.current, event].slice(-120);
        if (queue.current.length >= 20) void flush();
      },
    );
    const timer = setInterval(flush, 5000);
    const hide = () => {
      if (document.hidden) void flush();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      stop();
      void flush();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [enabled, choice, path, preview]);
  function choose(value: boolean) {
    allowed.current = false;
    queue.current = [];
    try {
      localStorage.setItem("kz.analytics.consent", value ? "yes" : "no");
      if (!value) sessionStorage.removeItem("kz.analytics.tab");
    } catch {}
    setChoice(value);
    setOpen(false);
  }
  if (preview || !enabled || !analyticsPath(path)) return null;
  return (
    <div data-no-analytics>
      <button
        className="analytics-preferences under-link"
        onClick={() => setOpen(true)}
      >
        İstatistik tercihleri
      </button>
      {(choice === null || open) && (
        <section
          className="analytics-consent"
          role="region"
          aria-label="İstatistik izni"
        >
          <p>
            Ziyaret ve tıklama istatistiklerini kaydetmemize izin verir misiniz?
            Form içerikleri kaydedilmez.
          </p>
          {privacyPreference() ? (
            <p>Tarayıcınızın gizlilik tercihi nedeniyle kayıt kapalıdır.</p>
          ) : (
            <button className="button" onClick={() => choose(true)}>
              İzin ver
            </button>
          )}
          <button className="under-link" onClick={() => choose(false)}>
            {choice === true ? "İzni geri çek" : "Reddet"}
          </button>
          <a className="under-link" href="/gizlilik">
            Gizlilik politikası
          </a>
        </section>
      )}
    </div>
  );
}
