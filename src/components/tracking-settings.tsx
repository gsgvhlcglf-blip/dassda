"use client";
import { useState, type FormEvent } from "react";
import { validTrackingTemplate } from "@/lib/tracking";
import type { Content } from "@/lib/types";
export function TrackingSettings({
  record,
  onSave,
}: {
  record?: Content;
  onSave: (record: Content, isNew: boolean) => Promise<void>;
}) {
  const [carrier, setCarrier] = useState(record?.title.tr || ""),
    [template, setTemplate] = useState(record?.body.tr || ""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (template && !validTrackingTemplate(template)) {
      setMessage("Geçerli bir HTTPS takip bağlantısı girin.");
      return;
    }
    if (template && !carrier.trim()) {
      setMessage("Kargo firmasının adını girin.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await onSave(
        {
          id: record?.id || crypto.randomUUID(),
          key: "shipping-tracking",
          title: { tr: carrier, en: carrier, ru: carrier },
          body: { tr: template, en: template, ru: template },
        },
        !record,
      );
      setMessage("Kargo takip ayarları kaydedildi.");
    } catch {
      setMessage("Ayarlar kaydedilemedi. Tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-guide">
      <p className="eyebrow">KARGO TAKİP</p>
      <h2>Firma ve takip bağlantısı</h2>
      <form onSubmit={submit}>
        <label>
          Kargo firması
          <input
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            maxLength={120}
          />
        </label>
        <label>
          HTTPS takip bağlantısı
          <input
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            maxLength={2000}
            type="url"
          />
        </label>
        <p className="muted">
          Firmanın resmi takip adresini ekleyin. Numaranın yazılacağı yere{" "}
          {"{tracking}"} eklenebilir. Bağlantı boşsa hizmet kapalı kalır. API
          anahtarı bu alana yazılmaz.
        </p>
        {message && <p role="status">{message}</p>}
        <button className="button" disabled={busy}>
          {busy ? "Kaydediliyor…" : "Kargo ayarlarını kaydet"}
        </button>
      </form>
    </section>
  );
}
