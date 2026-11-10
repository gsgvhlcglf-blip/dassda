"use client";
import { useEffect, useRef, useState } from "react";
import type { InvoiceMeta, InvoiceSource } from "@/lib/email-design";
import type { ManagedOrder } from "@/lib/order-management";
export const invoicesHTTP: InvoiceSource = {
  async list(order) {
    const r = await fetch(
      "/api/admin/invoices?order=" + encodeURIComponent(order),
      { cache: "no-store" },
    );
    const b = await r.json();
    if (!r.ok) throw Error(b.error);
    return b.invoices;
  },
  async upload(order, file, expected) {
    const form = new FormData();
    form.set("order", order);
    form.set("expected", String(expected));
    form.set("file", file);
    const r = await fetch("/api/admin/invoices", {
      method: "POST",
      body: form,
    });
    const b = await r.json();
    if (!r.ok) throw Error(b.error);
    return b.invoice;
  },
  async download(i) {
    const r = await fetch(
      "/api/admin/invoices?" +
        new URLSearchParams({ order: i.order_id, file: i.id }),
      { cache: "no-store" },
    );
    if (!r.ok) throw Error("Fatura indirilemedi.");
    return r.blob();
  },
};
export function OrderInvoices({
  order,
  source = invoicesHTTP,
  onUploaded,
}: {
  order: ManagedOrder;
  source?: InvoiceSource;
  onUploaded(): void;
}) {
  const [invoices, setInvoices] = useState<InvoiceMeta[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    source
      .list(order.id)
      .then((rows) => {
        if (active) setInvoices(rows);
      })
      .catch(() => {
        if (active) setStatus("Faturalar yüklenemedi.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [order.id, source]);
  const allowed =
    Boolean(source.sample) ||
    (order.payment_status === "paid" && order.status !== "cancelled");
  async function upload(selected?: File) {
    setBusy(true);
    setStatus("");
    try {
      let saved: InvoiceMeta;
      if (source.sample) saved = await source.sample(order.id);
      else if (selected && source.upload)
        saved = await source.upload(
          order.id,
          selected,
          invoices[0]?.version || 0,
        );
      else return;
      const duplicate = invoices.some((i) => i.id === saved.id);
      setInvoices(await source.list(order.id));
      onUploaded();
      setStatus(
        duplicate
          ? "Bu PDF zaten kayıtlı. İkinci bir e-posta oluşturulmadı."
          : source.sample
            ? "Örnek fatura eklendi. Gerçek fatura veya e-posta oluşturulmadı."
            : "Fatura kaydedildi. PDF eki, bu siparişin müşterisine gönderilmek üzere kuyruğa alındı.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Fatura yüklenemedi.");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }
  async function download(i: InvoiceMeta) {
    try {
      const blob = await source.download(i);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = i.file_name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setStatus("Fatura indirilemedi.");
    }
  }
  return (
    <section className="order-detail-card order-invoices">
      <h4>Fatura</h4>
      <p>
        {source.sample
          ? "Önizlemede yalnızca örnek PDF akışı denenir. Gerçek müşteri faturası yüklemeyin."
          : "Hazırladığınız PDF faturayı yükleyin. Fatura bu siparişe bağlanır ve müşterinin kayıtlı e-posta adresine otomatik gönderim için kuyruğa alınır."}
      </p>
      {!allowed && (
        <p>Fatura yüklemek için sipariş ödemesinin doğrulanması gerekir.</p>
      )}
      {source.sample ? (
        <button
          className="button secondary"
          disabled={busy || loading}
          onClick={() => void upload()}
        >
          Örnek fatura ile dene
        </button>
      ) : (
        <label className="invoice-upload">
          {invoices.length ? "Güncel PDF faturayı yükle" : "PDF fatura yükle"}
          <input
            ref={file}
            aria-label="PDF fatura yükle"
            type="file"
            accept="application/pdf,.pdf"
            disabled={!allowed || busy || loading}
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) void upload(selected);
            }}
          />
          <small>
            En fazla 4 MB · Fatura oluşturmaz, yüklediğiniz belgeyi iletir.
          </small>
        </label>
      )}
      {busy && <p role="status">Fatura kaydediliyor…</p>}
      {invoices.map((i, index) => (
        <div key={i.id} className="invoice-record">
          <span>
            <strong>{i.file_name}</strong>
            <small>
              {index === 0 ? "Güncel fatura" : "Önceki sürüm"} ·{" "}
              {new Date(i.created_at).toLocaleString("tr-TR")} ·{" "}
              {Math.ceil(i.size / 1024)} KB {i.demo ? "· DEMO" : ""}
            </small>
          </span>
          <button className="under-link" onClick={() => void download(i)}>
            PDF indir
          </button>
        </div>
      ))}
      {status && <p role="status">{status}</p>}
    </section>
  );
}
