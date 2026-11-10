"use client";
import { useEffect, useState } from "react";
import { emailKindLabels } from "@/lib/email-design";
import type { OrderNotice } from "@/lib/order-emails";
export function OrderNotices({
  orderId,
  sample,
}: {
  orderId: string;
  sample: boolean;
}) {
  const [data, setData] = useState<{
    ready: boolean;
    note: string;
    notices: OrderNotice[];
  } | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (sample) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(
          "/api/admin/notifications?order=" + encodeURIComponent(orderId),
          { cache: "no-store" },
        );
        if (!response.ok) throw Error();
        const body = await response.json();
        if (active) {
          setData(body);
          setError("");
        }
      } catch {
        if (active) setError("Bildirim durumu yüklenemedi.");
      }
    };
    void refresh();
    const timer = setInterval(refresh, 20000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [orderId, sample, busy]);
  async function retry() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: orderId }),
      });
      if (!response.ok) throw Error();
    } catch {
      setError(
        "Bu bildirim yeniden gönderime kapalı veya servis kullanılamıyor. Gönderim kaydını kontrol edin.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="order-detail-card order-notices">
      <h4>E-posta bildirimleri</h4>
      <p>
        {sample
          ? "Tasarım önizlemesinden gerçek e-posta gönderilmez. Sipariş, kargo ve fatura e-postaları canlı servis bağlandığında çalışır."
          : data?.note || "Bildirim durumu yükleniyor…"}
      </p>
      {data?.notices.map((n) => (
        <p key={n.id}>
          {emailKindLabels[n.kind]}
          {n.kind === "invoice_ready" ? ` · Sürüm ${n.version}` : ""} ·{" "}
          {
            {
              pending: "Kuyrukta",
              sending: "Gönderiliyor",
              sent: "E-posta servisi kabul etti",
              failed: "Gönderilemedi",
              review: "Kontrol gerekli",
            }[n.status]
          }
          {n.sent_at && <> · {new Date(n.sent_at).toLocaleString("tr-TR")}</>}
        </p>
      ))}
      {data && !data.notices.length && (
        <p>
          Yalnızca gerçek, ödemesi doğrulanmış siparişler için bildirim
          oluşturulur.
        </p>
      )}
      {data?.ready && data.notices.some((n) => n.status !== "sent") && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void retry()}
        >
          {busy ? "Kontrol ediliyor…" : "Gönderimi yeniden dene"}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
