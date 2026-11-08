"use client";
import { useEffect, useState } from "react";
export const cookieConsentKey = "kuzmin.gsgvhlcglf-blip.dassda.cookies.v1";
export const cookieConsentEvent = "kz-cookie-consent";
export const consentLifetime = 180 * 24 * 60 * 60 * 1000;
export type CookieChoice = {
  version: 1;
  analytics: boolean;
  savedAt: number;
  expiresAt: number;
};
let volatileChoice: CookieChoice | undefined;
export function parseCookieChoice(
  value: unknown,
  now = Date.now(),
): CookieChoice | null {
  if (!value || typeof value !== "object") return null;
  const c = value as CookieChoice;
  return c.version === 1 &&
    typeof c.analytics === "boolean" &&
    Number.isSafeInteger(c.savedAt) &&
    Number.isSafeInteger(c.expiresAt) &&
    c.savedAt <= now &&
    c.expiresAt > now &&
    c.expiresAt === c.savedAt + consentLifetime
    ? c
    : null;
}
export function readCookieChoice(): CookieChoice | null {
  if (volatileChoice) return parseCookieChoice(volatileChoice);
  try {
    return parseCookieChoice(
      JSON.parse(localStorage.getItem(cookieConsentKey) || "null"),
    );
  } catch {
    return null;
  }
}
export function saveCookieChoice(analytics: boolean) {
  const savedAt = Date.now();
  const choice: CookieChoice = {
    version: 1,
    analytics,
    savedAt,
    expiresAt: savedAt + consentLifetime,
  };
  let persisted = false;
  try {
    localStorage.setItem(cookieConsentKey, JSON.stringify(choice));
    persisted = true;
  } catch {}
  volatileChoice = persisted ? undefined : choice;
  try {
    localStorage.setItem("kz.analytics.consent", analytics ? "yes" : "no");
  } catch {}
  if (!analytics)
    try {
      sessionStorage.removeItem("kz.analytics.tab");
    } catch {}
  window.dispatchEvent(new Event(cookieConsentEvent));
  return persisted;
}
export function useCookieChoice() {
  const [choice, setChoice] = useState<CookieChoice | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const update = () => {
      const next = readCookieChoice();
      setChoice((previous) =>
        previous?.savedAt === next?.savedAt &&
        previous?.analytics === next?.analytics &&
        previous?.expiresAt === next?.expiresAt
          ? previous
          : next,
      );
      setReady(true);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === cookieConsentKey || event.key === null) update();
    };
    update();
    window.addEventListener(cookieConsentEvent, update);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener(cookieConsentEvent, update);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", update);
    };
  }, []);
  return { choice, ready };
}
