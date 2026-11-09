"use client";
import { useSiteText } from "./visual-text";
import { useEffect, useRef, useState } from "react";
import type { CartLine } from "@/lib/types";
import type { PaymentPublicConfig, PaymentState } from "@/lib/payments/types";
type Session = {
  id: string;
  state: PaymentState;
  provider: "paytr" | "iyzico";
  mode: "test" | "live";
  checkoutUrl: string | null;
};
export function useHostedPayment(
  preview: boolean,
  customerId: string,
  cart: CartLine[],
) {
  const [config, setConfig] = useState<PaymentPublicConfig>({
      provider: "none",
      mode: "test",
      enabled: false,
      ready: false,
    }),
    [session, setSession] = useState<Session | null>(null),
    [reference, setReference] = useState<string | null>(null),
    frame = useRef<HTMLIFrameElement>(null);
  const key = "kz.pendingPayment." + customerId,
    cartKey = JSON.stringify(cart);
  useEffect(() => {
    if (preview) return;
    let valid = true;
    fetch("/api/payments/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((value) => {
        if (valid) setConfig(value);
      })
      .catch(() => {});
    const id = new URLSearchParams(location.search).get("attempt");
    if (id) {
      fetch("/api/payments/status?id=" + encodeURIComponent(id), {
        cache: "no-store",
      })
        .then(async (r) => {
          if (!r.ok) return;
          const value = await r.json();
          if (!valid) return;
          if (value.state === "ready" && value.provider === "paytr")
            setSession(value);
          else
            location.replace("/odeme/sonuc?attempt=" + encodeURIComponent(id));
        })
        .catch(() => {});
    } else
      try {
        const pending = JSON.parse(sessionStorage.getItem(key) || "null");
        if (pending?.cart === cartKey && typeof pending.id === "string")
          location.replace(
            "/odeme/sonuc?attempt=" + encodeURIComponent(pending.id),
          );
      } catch {}
    return () => {
      valid = false;
    };
  }, [preview, customerId]);
  useEffect(() => {
    if (!session) return;
    const listener = (event: MessageEvent) => {
      if (
        event.origin === location.origin &&
        event.source === frame.current?.contentWindow &&
        event.data?.type === "kz-payment-return" &&
        event.data.id === session.id
      )
        location.assign("/odeme/sonuc?attempt=" + session.id);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [session]);
  async function open(orderReference: string, form: FormData) {
    setReference(orderReference);
    const response = await fetch("/api/payments/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: orderReference,
          expectedProvider: config.provider,
          expectedMode: config.mode,
          ...(config.provider === "iyzico"
            ? {
                city: form.get("buyer_city"),
                country: form.get("buyer_country"),
                identity: form.get("buyer_identity"),
              }
            : {}),
        }),
      }),
      value = await response.json();
    if (!response.ok) {
      if (
        ["ORDER_EXPIRED", "DEMO_PAYMENT_BLOCKED", "OUT_OF_STOCK"].includes(
          value.error,
        )
      )
        setReference(null);
      throw Error(value.error);
    }
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({ id: value.id, cart: cartKey }),
      );
    } catch {}
    if (value.state !== "ready") {
      location.assign("/odeme/sonuc?attempt=" + value.id);
      return;
    }
    if (value.provider === "iyzico") location.assign(value.checkoutUrl);
    else setSession(value);
  }
  return { config, session, reference, frame, open };
}
export function HostedPayment({
  session,
  frame,
}: {
  session: Session;
  frame: React.RefObject<HTMLIFrameElement | null>;
}) {
  const fixedText = useSiteText();

  return (
    <section className="page-section">
      <p
        className="eyebrow"
        data-visual-text={"slot:copy.payment.bndimeemeipa"}
      >
        {fixedText("copy.payment.bndimeemeipa")}
      </p>
      <h1 data-visual-text={"slot:copy.payment.igmeaocfbiek"}>
        {fixedText("copy.payment.igmeaocfbiek")}
      </h1>
      {session.mode === "test" && (
        <p className="demo-box">Test modu · Gerçek tahsilat yapılmaz.</p>
      )}
      <p data-visual-text={"slot:copy.payment.lofiiimcgemi"}>
        {fixedText("copy.payment.lofiiimcgemi")}
      </p>
      {session.checkoutUrl && (
        <iframe
          ref={frame}
          className="payment-gateway-frame"
          src={session.checkoutUrl}
          title={fixedText("copy.payment.opbkiklecaih")}
          allow="payment"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
      <a
        className="under-link"
        href={"/odeme/sonuc?attempt=" + session.id}
        data-visual-text={"slot:copy.payment.binnmingpdhk"}
      >
        {fixedText("copy.payment.binnmingpdhk")}
      </a>
    </section>
  );
}
