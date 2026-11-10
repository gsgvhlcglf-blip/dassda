import { useEffect, useState } from "react";
import {
  appendPreviewAnalytics,
  readPreviewAnalytics,
} from "../../src/lib/analytics-preview";
import {
  createAnalyticsRecorder,
  privacyPreference,
} from "../../src/lib/analytics-recorder";
import {
  readCookieChoice,
  useCookieChoice,
} from "../../src/lib/cookie-consent";
import { analyticsPath } from "../../src/lib/analytics";
export function PreviewAnalyticsRecorder({
  path,
  revision,
}: {
  path: string;
  revision: string;
}) {
  const { choice } = useCookieChoice();
  const [enabled, setEnabled] = useState(() => readPreviewAnalytics().enabled),
    [recording, setRecording] = useState(false);
  useEffect(() => {
    const update = () => setEnabled(readPreviewAnalytics().enabled);
    window.addEventListener("storage", update);
    window.addEventListener("kz-preview-analytics", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("kz-preview-analytics", update);
    };
  }, []);
  useEffect(() => {
    if (!enabled || !choice?.analytics) setRecording(false);
  }, [enabled, choice]);
  useEffect(() => {
    if (!enabled || !recording || !choice?.analytics) return;
    return createAnalyticsRecorder(path, revision, (event) => {
      if (readCookieChoice()?.analytics) appendPreviewAnalytics(event);
    });
  }, [enabled, recording, path, revision, choice]);
  if (!enabled || (!analyticsPath(path) && path !== "/odeme")) return null;
  return (
    <aside
      className="analytics-test-banner"
      data-no-analytics
      aria-label="Önizleme test kaydı"
    >
      <p>
        {recording
          ? path === "/odeme"
            ? "Test kaydı açık · Yalnızca ödeme adımı sayılır; form bilgileri kaydedilmez."
            : "Test kaydı açık · Tıklamalar ve kaydırma bu tarayıcıya kaydediliyor."
          : "Yalnızca bu tarayıcı için test kaydı. Gerçek ziyaretçi verisi değildir."}
      </p>
      {!choice?.analytics && (
        <span>Test kaydı için çerez tercihlerinden analize izin ver.</span>
      )}
      {privacyPreference() ? (
        <span>Tarayıcı gizlilik tercihi nedeniyle kapalı.</span>
      ) : (
        <button
          className="under-link"
          disabled={!choice?.analytics}
          onClick={() => setRecording((value) => !value)}
        >
          {recording ? "Test kaydını durdur" : "Test kaydını başlat"}
        </button>
      )}
    </aside>
  );
}
