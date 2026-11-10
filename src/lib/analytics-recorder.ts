import { analyticsPath, type AnalyticsEvent } from "./analytics";
let fallbackSession: string | undefined;
export function analyticsSession() {
  try {
    const key = "kz.analytics.tab";
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID();
      sessionStorage.setItem(key, value);
    }
    return value;
  } catch {
    return (fallbackSession ||= crypto.randomUUID());
  }
}
export function privacyPreference() {
  return (
    navigator.doNotTrack === "1" ||
    Boolean(
      (navigator as Navigator & { globalPrivacyControl?: boolean })
        .globalPrivacyControl,
    )
  );
}
export function createAnalyticsRecorder(
  path: string,
  revision: string,
  emit: (event: AnalyticsEvent) => void,
) {
  const clean = analyticsPath(path) || (path === "/odeme" ? "/odeme" : null);
  if (!clean || privacyPreference()) return () => {};
  const session_id = analyticsSession();
  let maximum = 0,
    lastSent = 0,
    timer: ReturnType<typeof setTimeout> | undefined;
  const dimensions = () => ({
    viewport_width: Math.min(7680, Math.max(240, innerWidth)),
    viewport_height: Math.min(4320, Math.max(200, innerHeight)),
    document_width: Math.min(
      16384,
      Math.max(240, document.documentElement.scrollWidth),
    ),
    document_height: Math.min(
      100000,
      Math.max(200, document.documentElement.scrollHeight),
    ),
  });
  let referrer_host = "";
  try {
    const ref = new URL(document.referrer);
    if (ref.origin !== location.origin) referrer_host = ref.hostname;
  } catch {}
  const send = (
    kind: AnalyticsEvent["kind"],
    data: Partial<AnalyticsEvent> = {},
  ) =>
    emit({
      id: crypto.randomUUID(),
      session_id,
      kind,
      path: clean,
      ...dimensions(),
      x: null,
      y: null,
      depth: null,
      referrer_host,
      revision,
      ...data,
    });
  // Checkout records one anonymous step only. No form listeners, heatmap, query or referrer.
  if (clean === "/odeme") {
    send("checkout_start", { referrer_host: "" });
    return () => {};
  }
  const depth = () =>
    Math.min(
      1,
      Math.round(
        ((scrollY + innerHeight) /
          Math.max(innerHeight, document.documentElement.scrollHeight)) *
          1000,
      ) / 1000,
    );
  maximum = depth();
  lastSent = maximum;
  send("pageview", { depth: maximum });
  const click = (event: MouseEvent) => {
    const target = event.target;
    if (
      !(target instanceof Element) ||
      target.closest(
        "input,textarea,select,form,[contenteditable],[data-no-analytics]",
      )
    )
      return;
    const d = dimensions();
    send("click", {
      x:
        Math.round(
          Math.max(
            0,
            Math.min(1, (event.clientX + scrollX) / d.document_width),
          ) * 1000,
        ) / 1000,
      y:
        Math.round(
          Math.max(
            0,
            Math.min(1, (event.clientY + scrollY) / d.document_height),
          ) * 1000,
        ) / 1000,
    });
  };
  const flushDepth = () => {
    if (maximum > lastSent) {
      send("scroll", { depth: maximum });
      lastSent = maximum;
    }
  };
  const scroll = () => {
    maximum = Math.max(maximum, depth());
    clearTimeout(timer);
    timer = setTimeout(flushDepth, 600);
  };
  const cartAdded = () => {
    if (/^\/urunler\/[a-zA-Z0-9_-]+$/.test(clean)) send("cart_add");
  };
  document.addEventListener("kz-cart-added", cartAdded);
  document.addEventListener("click", click, true);
  window.addEventListener("scroll", scroll, { passive: true });
  window.addEventListener("pagehide", flushDepth);
  return () => {
    clearTimeout(timer);
    flushDepth();
    document.removeEventListener("click", click, true);
    document.removeEventListener("kz-cart-added", cartAdded);
    window.removeEventListener("scroll", scroll);
    window.removeEventListener("pagehide", flushDepth);
  };
}
