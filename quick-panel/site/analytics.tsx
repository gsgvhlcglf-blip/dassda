import { useEffect, useState } from "react";
import {
  appendPreviewAnalytics,
  readPreviewAnalytics,
} from "../../src/lib/analytics-preview";
import {
  createAnalyticsRecorder,
  privacyPreference,
} from "../../src/lib/analytics-recorder";
import { analyticsPath } from "../../src/lib/analytics";
export function PreviewAnalyticsRecorder({
  path,
  revision,
}: {
  path: string;
  revision: string;
}) {
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
    if (!enabled) setRecording(false);
  }, [enabled]);
  useEffect(() => {
    if (!enabled || !recording) return;
    return createAnalyticsRecorder(path, revision, appendPreviewAnalytics);
  }, [enabled, recording, path, revision]);
  if (!enabled || !analyticsPath(path)) return null;
  return (
    <aside
      className="analytics-test-banner"
      data-no-analytics
      aria-label="Önizleme test kaydı"
    >
      <p>
        {recording
          ? "Test kaydı açık · Tıklamalar ve kaydırma bu tarayıcıya kaydediliyor."
          : "Yalnızca bu tarayıcı için test kaydı. Gerçek ziyaretçi verisi değildir."}
      </p>
      {privacyPreference() ? (
        <span>Tarayıcı gizlilik tercihi nedeniyle kapalı.</span>
      ) : (
        <button
          className="under-link"
          onClick={() => setRecording((value) => !value)}
        >
          {recording ? "Test kaydını durdur" : "Test kaydını başlat"}
        </button>
      )}
    </aside>
  );
}
