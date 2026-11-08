"use client";
import { useEffect, useRef, useState } from "react";
import { analyticsPath, type AnalyticsEvent } from "@/lib/analytics";
import {
  createAnalyticsRecorder,
  privacyPreference,
} from "@/lib/analytics-recorder";
import { CookieNotice } from "./cookie-notice";
import {
  cookieConsentEvent,
  cookieConsentKey,
  readCookieChoice,
  useCookieChoice,
  parseCookieChoice,
} from "@/lib/cookie-consent";
export function AnalyticsTracker({
  path,
  preview = false,
}: {
  path: string;
  preview?: boolean;
}) {
  const { choice } = useCookieChoice();
  const [enabled, setEnabled] = useState(false),
    queue = useRef<AnalyticsEvent[]>([]),
    allowed = useRef(false),
    sending = useRef(false);
  useEffect(() => {
    if (preview) return;
    const discard = () => {
      allowed.current = false;
      queue.current = [];
    };
    const syncConsent = (event: StorageEvent) => {
      if (event.key !== cookieConsentKey && event.key !== null) return;
      let next = null;
      try {
        next = parseCookieChoice(JSON.parse(event.newValue || "null"));
      } catch {}
      if (!next?.analytics) discard();
    };
    window.addEventListener("storage", syncConsent);
    window.addEventListener(cookieConsentEvent, discard);
    fetch("/api/analytics/settings", {
      cache: "no-store",
      referrerPolicy: "no-referrer",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((value) => setEnabled(value?.enabled === true))
      .catch(() => {});
    return () => {
      window.removeEventListener("storage", syncConsent);
      window.removeEventListener(cookieConsentEvent, discard);
    };
  }, [preview]);
  const flush = async () => {
    if (
      !allowed.current ||
      !readCookieChoice()?.analytics ||
      privacyPreference() ||
      sending.current ||
      !queue.current.length
    )
      return;
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
      enabled && choice?.analytics === true && !preview && !privacyPreference();
    if (!allowed.current || !analyticsPath(path)) return;
    const stop = createAnalyticsRecorder(
      path,
      process.env.NEXT_PUBLIC_ANALYTICS_REVISION || "site",
      (event) => {
        if (allowed.current && readCookieChoice()?.analytics)
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
  return <CookieNotice />;
}
