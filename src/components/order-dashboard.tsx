"use client";
import { useEffect, useState } from "react";
import { money } from "@/lib/i18n";
import { paymentStatusLabel } from "@/lib/payments/types";
import {
  shipmentSchema,
  shippingLabel,
  shippingState,
  safeShipmentURL,
  type ManagedOrder,
  type ShipmentInput,
} from "@/lib/order-management";

export type OrdersTransport = {
  list: () => Promise<{ orders: ManagedOrder[]; demo: boolean }>;
  share: (id: string, input: ShipmentInput) => Promise<ManagedOrder>;
  sample?: () => Promise<void>;
};
export const ordersHTTP: OrdersTransport = {
  async list() {
    const response = await fetch("/api/admin/orders", { cache: "no-store" }),
      body = await response.json();
    if (!response.ok) throw Error(body.error || "Siparişler yüklenemedi.");
    return body;
  },
  async share(id, shipment) {
    const response = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, shipment }),
      }),
      body = await response.json();
    if (!response.ok) throw Error(body.error || "Kargo bilgisi kaydedilemedi.");
    return body.order;
  },
};
export function OrderDashboard({
  transport = ordersHTTP,
}: {
  transport?: OrdersTransport;
}) {
  const [orders, setOrders] = useState<ManagedOrder[]>([]),
    [demo, setDemo] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [selected, setSelected] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("");
  const [number, setNumber] = useState(""),
    [carrier, setCarrier] = useState(""),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState("");
  const order = orders.find((row) => row.id === selected);
  async function load() {
    try {
      const result = await transport.list();
      setOrders(result.orders);
      setDemo(result.demo);
      setError("");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Siparişler yüklenemedi.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const refresh = () => {
      if (!document.hidden) void load();
    };
    const timer = setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [transport]);
  useEffect(() => {
    setNumber(order?.tracking_number || "");
    setCarrier(order?.shipping_carrier || "");
  }, [order?.id, order?.fulfillment_version]);
  useEffect(() => setFeedback(""), [order?.id]);
  const list = orders.filter(
    (row) =>
      (!filter || shippingState(row) === filter) &&
      `${row.reference} ${row.customer_name} ${row.email} ${row.phone} ${row.items.map((item) => item.title + " " + item.sku).join(" ")}`
        .toLocaleLowerCase("tr")
        .includes(query.toLocaleLowerCase("tr")),
  );
  async function share() {
    if (!order) return;
    setBusy(true);
    setFeedback("");
    try {
      const parsed = shipmentSchema.safeParse({
        tracking_number: number,
        shipping_carrier: carrier,
        expected_version: Number(order.fulfillment_version || 0),
      });
      if (!parsed.success) throw Error(parsed.error.issues[0].message);
      const updated = await transport.share(order.id, parsed.data);
      setOrders((rows) =>
        rows.map((row) => (row.id === updated.id ? updated : row)),
      );
      setFeedback(
        "Kargo takip numarası paylaşıldı. Müşteri hesabındaki durum güncellendi.",
      );
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Kargo bilgisi kaydedilemedi.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function copyTracking() {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(
        `${order.reference} · ${shippingLabel(order)}\n${order.shipping_carrier || "Kargo"}\nTakip numarası: ${order.tracking_number}${safeShipmentURL(order.tracking_url) ? "\n" + order.tracking_url : ""}`,
      );
      setFeedback("Takip mesajı kopyalandı.");
    } catch {
      setFeedback(
        "Kopyalanamadı. Takip numarasını aşağıdan seçip kopyalayabilirsin.",
      );
    }
  }
  const unavailable =
    !!order &&
    (order.status === "cancelled" ||
      (!!order.payment_provider && order.payment_status !== "paid"));
  return (
    <section className="orders-dashboard">
      <div className="orders-toolbar">
        <button
          type="button"
          className="button secondary"
          onClick={() => void load()}
        >
          Siparişleri yenile
        </button>
        {transport.sample && (
          <button
            type="button"
            className="button secondary"
            onClick={async () => {
              await transport.sample!();
              await load();
            }}
          >
            Örnek sipariş ekle
          </button>
        )}
      </div>
      {demo && (
        <p className="orders-demo">
          DEMO · Bu çalışma alanındaki örnek kayıtlar gerçek sipariş değildir.
          Gerçek müşteri bilgisi girme.
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Siparişler yükleniyor…</p>
      ) : order ? (
        <>
          <button
            type="button"
            className="under-link"
            onClick={() => setSelected("")}
          >
            ← Siparişlere dön
          </button>
          <div className="order-detail-heading">
            <h3>{order.reference}</h3>
            <span className="status-tag">{shippingLabel(order)}</span>
          </div>
          <div className="order-detail-grid">
            <section className="order-detail-card">
              <h4>Müşteri ve teslimat</h4>
              <dl>
                <dt>Ad soyad</dt>
                <dd>{order.customer_name}</dd>
                <dt>E-posta</dt>
                <dd>{order.email}</dd>
                <dt>Cep telefonu</dt>
                <dd>{order.phone}</dd>
                <dt>Teslimat adresi</dt>
                <dd className="order-preserve">{order.address}</dd>
                <dt>Sipariş notu</dt>
                <dd className="order-preserve">{order.note || "—"}</dd>
                <dt>Sipariş tarihi</dt>
                <dd>
                  {new Date(order.created_at).toLocaleString("tr-TR", {
                    timeZone: "Europe/Istanbul",
                  })}
                </dd>
              </dl>
            </section>
            <section className="order-detail-card">
              <h4>Ödeme ve tutar</h4>
              <dl>
                <dt>Toplam</dt>
                <dd>{money(order.total, "tr", order.currency)}</dd>
                <dt>Ödeme durumu</dt>
                <dd>
                  {paymentStatusLabel(order.payment_status || "request_only")}
                </dd>
                <dt>Ödeme sağlayıcısı</dt>
                <dd>{order.payment_provider || "—"}</dd>
                <dt>Ödeme referansı</dt>
                <dd>{order.payment_reference || "—"}</dd>
                <dt>Ödeme tarihi</dt>
                <dd>
                  {order.paid_at
                    ? new Date(order.paid_at).toLocaleString("tr-TR", {
                        timeZone: "Europe/Istanbul",
                      })
                    : "—"}
                </dd>
              </dl>
              {order.demo && <p>Örnek sipariş · Gerçek tahsilat değildir.</p>}
            </section>
          </div>
          <section className="order-detail-card">
            <h4>Sipariş edilen ürünler</h4>
            <div className="orders-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ürün / SKU</th>
                    <th>Adet</th>
                    <th>Birim fiyat</th>
                    <th>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.title}
                        <small>{item.sku}</small>
                      </td>
                      <td>{item.quantity}</td>
                      <td>{money(item.unit_price, "tr", order.currency)}</td>
                      <td>
                        {money(
                          item.quantity * item.unit_price,
                          "tr",
                          order.currency,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="order-detail-card order-shipment">
            <h4>Kargo takip numarasını paylaş</h4>
            <p>
              Takip numarası müşterinin bu tarayıcıdaki Siparişlerim sayfasında
              görünür. Paylaşana kadar sipariş “Sipariş hazırlanıyor” olarak
              görünür.
            </p>
            <div className="order-detail-grid">
              <label>
                Kargo firması (isteğe bağlı)
                <input
                  aria-label="Sipariş kargo firması"
                  value={carrier}
                  maxLength={120}
                  disabled={busy || unavailable}
                  onChange={(event) => setCarrier(event.target.value)}
                />
              </label>
              <label>
                Kargo takip numarası
                <input
                  aria-label="Sipariş kargo takip numarası"
                  value={number}
                  maxLength={80}
                  disabled={busy || unavailable}
                  onChange={(event) => setNumber(event.target.value)}
                />
              </label>
            </div>
            {unavailable && (
              <p role="status">
                {order.status === "cancelled"
                  ? "İptal edilmiş siparişin kargo bilgisi paylaşılamaz."
                  : "Ödeme doğrulanmadan kargo bilgisi paylaşılamaz."}
              </p>
            )}
            <div className="orders-toolbar">
              <button
                type="button"
                className="button"
                disabled={busy || unavailable}
                onClick={() => void share()}
              >
                {busy
                  ? "Kaydediliyor…"
                  : shippingState(order) === "shipped"
                    ? "Takip numarasını güncelle"
                    : "Kargo takip numarasını paylaş"}
              </button>
              {shippingState(order) === "shipped" && (
                <>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => void copyTracking()}
                  >
                    Takip mesajını kopyala
                  </button>
                  {safeShipmentURL(order.tracking_url) && (
                    <a
                      className="button secondary"
                      href={safeShipmentURL(order.tracking_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Kargoyu takip et ↗
                    </a>
                  )}
                </>
              )}
            </div>
            {order.shipped_at && (
              <p>
                Paylaşım tarihi:{" "}
                {new Date(order.shipped_at).toLocaleString("tr-TR", {
                  timeZone: "Europe/Istanbul",
                })}
              </p>
            )}
            {feedback && <p role="status">{feedback}</p>}
          </section>
        </>
      ) : (
        <>
          <div className="orders-stats">
            <span>{orders.length} sipariş</span>
            <span>
              {
                orders.filter((row) => shippingState(row) === "preparing")
                  .length
              }{" "}
              hazırlanıyor
            </span>
            <span>
              {orders.filter((row) => shippingState(row) === "shipped").length}{" "}
              kargoya verildi
            </span>
          </div>
          <div className="orders-filters">
            <input
              type="search"
              aria-label="Siparişlerde ara"
              placeholder="Sipariş, müşteri, telefon veya ürün ara…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              aria-label="Kargo durumuna göre filtrele"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="">Tüm siparişler</option>
              <option value="preparing">Sipariş hazırlanıyor</option>
              <option value="shipped">Siparişiniz kargoya verildi</option>
            </select>
          </div>
          <div className="orders-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sipariş</th>
                  <th>Müşteri</th>
                  <th>Toplam / Ödeme</th>
                  <th>Kargo durumu</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className="order-open"
                        onClick={() => setSelected(row.id)}
                      >
                        {row.reference}
                      </button>
                      <small>
                        {new Date(row.created_at).toLocaleDateString("tr-TR", {
                          timeZone: "Europe/Istanbul",
                        })}
                        {row.demo ? " · DEMO" : ""}
                      </small>
                    </td>
                    <td>
                      {row.customer_name}
                      <small>{row.email}</small>
                    </td>
                    <td>
                      {money(row.total, "tr", row.currency)}
                      <small>
                        {paymentStatusLabel(
                          row.payment_status || "request_only",
                        )}
                      </small>
                    </td>
                    <td>{shippingLabel(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!list.length && (
            <p className="empty" role="status">
              {orders.length
                ? "Aramana uygun sipariş bulunamadı."
                : "Henüz sipariş yok. Oluşan siparişler burada görünecek."}
            </p>
          )}
        </>
      )}
    </section>
  );
}
