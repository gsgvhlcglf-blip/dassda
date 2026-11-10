"use client";
import { useEffect, useState } from "react";
import {
  defaultEmailDesign,
  emailDesignSchema,
  emailKinds,
  emailKindLabels,
  emailExampleOrder,
  renderOrderEmail,
  type EmailDesign,
  type EmailDesignRecord,
  type EmailDesignSource,
  type EmailKind,
  type InvoiceMeta,
  type InvoiceSource,
} from "@/lib/email-design";
import { invoicesHTTP } from "./order-invoices";
import type { ManagedOrder } from "@/lib/order-management";
export const emailDesignHTTP: EmailDesignSource = {
  async load() {
    const r = await fetch("/api/admin/email-design", { cache: "no-store" });
    const data = await r.json();
    if (!r.ok) throw Error(data.error);
    return data;
  },
  async save(expected, settings) {
    const r = await fetch("/api/admin/email-design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expected, settings }),
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.error);
    return data;
  },
};
export function EmailDesigner({
  source = emailDesignHTTP,
  order,
  onClose,
  invoiceSource = invoicesHTTP,
}: {
  source?: EmailDesignSource;
  order?: ManagedOrder;
  invoiceSource?: InvoiceSource;
  onClose(): void;
}) {
  const [record, setRecord] = useState<EmailDesignRecord | null>(null),
    [design, setDesign] = useState<EmailDesign>(
      structuredClone(defaultEmailDesign),
    );
  const [kind, setKind] = useState<EmailKind>("order_confirmed"),
    [mobile, setMobile] = useState(false),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  useEffect(() => {
    let active = true;
    source
      .load()
      .then((r) => {
        if (active) {
          setRecord(r);
          setDesign(r.settings);
        }
      })
      .catch(() => {
        if (active) setStatus("E-posta ayarları yüklenemedi.");
      });
    return () => {
      active = false;
    };
  }, [source]);
  const [invoice, setInvoice] = useState<InvoiceMeta | undefined>();
  useEffect(() => {
    let active = true;
    setInvoice(undefined);
    if (order)
      invoiceSource
        .list(order.id)
        .then((rows) => {
          if (active) setInvoice(rows[0]);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [order?.id, invoiceSource]);
  const preview = renderOrderEmail(
    kind,
    order || emailExampleOrder(),
    design,
    invoice || {
      file_name: "Örnek fatura.pdf",
      version: 1,
    },
  );
  function change(next: EmailDesign) {
    setDesign(next);
    setDirty(true);
    setStatus("");
  }
  async function save() {
    const parsed = emailDesignSchema.safeParse(design);
    if (!parsed.success) {
      setStatus(
        "E-posta adreslerini ve zorunlu başlık alanlarını kontrol edin.",
      );
      return;
    }
    if (!record) return;
    setBusy(true);
    try {
      const result = await source.save(record.revision, parsed.data);
      setRecord(result);
      setDesign(result.settings);
      setDirty(false);
      setStatus("E-posta tasarımları kaydedildi.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }
  const current = design.templates[kind];
  return (
    <section className="email-designer">
      <div className="orders-toolbar">
        <button className="under-link" onClick={onClose}>
          ← Siparişlere dön
        </button>
        <h3>E-posta tasarımları</h3>
        <button
          className="button"
          disabled={!record || busy || !dirty}
          onClick={() => void save()}
        >
          {busy ? "Kaydediliyor…" : "Tasarımları kaydet"}
        </button>
      </div>
      <p className="orders-demo">
        {record?.sample
          ? "TASARIM TASLAĞI · Bu tarayıcıda saklanır; gerçek e-posta gönderilmez."
          : "Önizleme e-posta göndermez. Kaydedilen tasarım yeni bildirimlerde kullanılır."}{" "}
        {dirty ? "Kaydedilmemiş değişiklikler var." : ""}
      </p>
      <div className="email-design-layout">
        <div className="email-design-controls">
          <fieldset>
            <legend>Gönderici ve marka</legend>
            <label>
              Satış e-posta adresi
              <input
                type="email"
                placeholder="Daha sonra eklenecek"
                value={design.senderEmail}
                maxLength={254}
                onChange={(e) =>
                  change({ ...design, senderEmail: e.target.value })
                }
              />
            </label>
            <p>
              Bu adresin gönderim yetkisi sunucuda doğrulanınca otomatik
              gönderim açılır. Şifre veya API anahtarı girmeyin.
            </p>
            <label>
              Yanıt adresi (isteğe bağlı)
              <input
                type="email"
                value={design.replyTo}
                maxLength={254}
                onChange={(e) => change({ ...design, replyTo: e.target.value })}
              />
            </label>
            <label>
              Marka adı
              <input
                value={design.brand}
                maxLength={60}
                onChange={(e) => change({ ...design, brand: e.target.value })}
              />
            </label>
            <label>
              Logo altı yazısı
              <input
                value={design.tagline}
                maxLength={100}
                onChange={(e) => change({ ...design, tagline: e.target.value })}
              />
            </label>
            <label>
              Vurgu rengi
              <input
                aria-label="E-posta vurgu rengi"
                type="color"
                value={design.accent}
                onChange={(e) => change({ ...design, accent: e.target.value })}
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>E-posta içeriği</legend>
            <label>
              E-posta türü
              <select
                aria-label="E-posta türü"
                value={kind}
                onChange={(e) => setKind(e.target.value as EmailKind)}
              >
                {emailKinds.map((k) => (
                  <option key={k} value={k}>
                    {emailKindLabels[k]}
                  </option>
                ))}
              </select>
            </label>
            {(
              [
                ["subject", "Konu satırı"],
                ["heading", "Başlık"],
                ["intro", "Açıklama"],
                ["footer", "Alt not"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                {key === "intro" || key === "footer" ? (
                  <textarea
                    rows={4}
                    maxLength={key === "intro" ? 1200 : 600}
                    value={current[key]}
                    onChange={(e) =>
                      change({
                        ...design,
                        templates: {
                          ...design.templates,
                          [kind]: { ...current, [key]: e.target.value },
                        },
                      })
                    }
                  />
                ) : (
                  <input
                    maxLength={key === "subject" ? 180 : 120}
                    value={current[key]}
                    onChange={(e) =>
                      change({
                        ...design,
                        templates: {
                          ...design.templates,
                          [kind]: { ...current, [key]: e.target.value },
                        },
                      })
                    }
                  />
                )}
              </label>
            ))}
            {kind === "shipment_shared" && (
              <label>
                Takip düğmesi yazısı
                <input
                  value={current.button}
                  maxLength={60}
                  onChange={(e) =>
                    change({
                      ...design,
                      templates: {
                        ...design.templates,
                        [kind]: { ...current, button: e.target.value },
                      },
                    })
                  }
                />
              </label>
            )}
            <p>
              Sipariş numarası, ürünler, fiyatlar ve brüt toplam gerçek
              siparişten otomatik gelir. Konu satırında {"{siparis_no}"}{" "}
              kullanılabilir.
            </p>
          </fieldset>
          {status && <p role="status">{status}</p>}
        </div>
        <div className="email-design-preview">
          <div className="orders-toolbar">
            <button
              className="button secondary"
              aria-pressed={!mobile}
              onClick={() => setMobile(false)}
            >
              Masaüstü e-posta
            </button>
            <button
              className="button secondary"
              aria-pressed={mobile}
              onClick={() => setMobile(true)}
            >
              Mobil e-posta
            </button>
          </div>
          <div className="email-envelope">
            <p>
              <strong>Gönderen:</strong> {design.brand} ·{" "}
              {design.senderEmail || "Satış e-postası daha sonra eklenecek"}
            </p>
            <p>
              <strong>Alıcı:</strong> {preview.to}
            </p>
            <p>
              <strong>Konu:</strong> {preview.subject}
            </p>
            {kind === "invoice_ready" && (
              <p>
                <strong>Ek:</strong>{" "}
                {invoice?.file_name ||
                  "Örnek PDF alanı · Henüz fatura seçilmedi"}
              </p>
            )}
            <small>
              {order
                ? "Seçili siparişin bilgileriyle önizleme."
                : "Örnek sipariş verileri · Gerçek satış değildir."}
            </small>
          </div>
          <iframe
            className="email-preview-frame"
            style={{ width: mobile ? 375 : 660 }}
            title="E-posta tasarım önizlemesi"
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={preview.html}
          />
        </div>
      </div>
    </section>
  );
}
