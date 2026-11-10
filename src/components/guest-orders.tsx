"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { money } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import type { CustomerOrder } from "@/server/persistence/contracts";
import { safeShipmentURL, shippingState } from "@/lib/order-management";
import { VisualText, useSiteText } from "./visual-text";

export function GuestOrders({
  preview = false,
  lang,
}: {
  preview?: boolean;
  lang: Lang;
}) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState(false);
  const text = useSiteText();
  useEffect(() => {
    if (preview) return;
    let active = true;
    async function refresh() {
      try {
        const response = await fetch("/api/orders", { cache: "no-store" });
        if (!response.ok) throw Error();
        const data = await response.json();
        if (active) {
          setOrders(data.orders);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void refresh();
    const timer = setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [preview]);
  return (
    <section className="page-section account-page">
      <h1>
        <VisualText textKey="slot:copy.guest.title" />
      </h1>
      <p className="muted">
        <VisualText textKey="slot:copy.guest.intro" />
      </p>
      {loading ? (
        <p role="status">
          <VisualText textKey="slot:copy.guest.loading" />
        </p>
      ) : error ? (
        <p role="alert">
          <VisualText textKey="ui:error" />
        </p>
      ) : !orders.length ? (
        <p className="empty-state">
          <VisualText textKey="slot:copy.guest.empty" />
        </p>
      ) : (
        <div className="member-orders">
          {orders.map((order) => (
            <article key={order.reference} className="account-order">
              <h2>
                {order.reference} {order.demo ? <small>DEMO</small> : null}
              </h2>
              <p>{money(order.total, lang)}</p>
              <p>
                <VisualText
                  textKey={
                    shippingState(order) === "shipped"
                      ? "ui:shippingShipped"
                      : "ui:shippingPreparing"
                  }
                />
              </p>
              {shippingState(order) === "shipped" && (
                <div className="account-tracking">
                  <p>
                    {order.shipping_carrier} {order.tracking_number}
                  </p>
                  {safeShipmentURL(order.tracking_url) && (
                    <a
                      className="under-link"
                      href={safeShipmentURL(order.tracking_url)!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {text("copy.guest.track")}
                    </a>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <Link className="under-link" href="/urunler">
        <VisualText textKey="ui:continue" />
      </Link>
    </section>
  );
}
