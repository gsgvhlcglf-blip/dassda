"use client";
import { useEffect, useState } from "react";
import type { PaymentSettings as Settings } from "@/lib/payments/types";
type Status = {
  settings: Settings;
  ready: boolean;
  missing: string[];
  origin: string | null;
  callbacks: { paytr: string | null; iyzico: string | null };
};
export function PaymentSettings() {
  const [data, setData] = useState<Status | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    fetch("/api/admin/payments", { cache: "no-store" })
      .then(async (r) => {
        const value = await r.json();
        if (!r.ok) throw Error(value.error);
        setData(value);
      })
      .catch((error) => setError(error.message));
  }, []);
  async function save() {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data.settings),
        }),
        value = await r.json();
      if (!r.ok) throw Error(value.error);
      setData(value);
      setMessage("Ödeme ayarları kaydedildi.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="analytics-card payment-settings">
      <p className="eyebrow">PAYTR / IYZICO</p>
      <h2>Ödeme altyapısı</h2>
      <p>
        Sağlayıcıyı seçin. Test modu gerçek tahsilat yapmaz. Kart bilgileri
        sağlayıcının güvenli ekranına girilir.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p>Yükleniyor…</p>}
      {data && (
        <>
          <div className="studio-photo-controls">
            <label>
              Ödeme sağlayıcısı
              <select
                aria-label="Ödeme sağlayıcısı"
                value={data.settings.provider}
                onChange={(e) =>
                  setData({
                    ...data,
                    settings: {
                      ...data.settings,
                      provider: e.target.value as Settings["provider"],
                      enabled: false,
                    },
                  })
                }
              >
                <option value="none">Henüz seçilmedi</option>
                <option value="paytr">PayTR</option>
                <option value="iyzico">iyzico</option>
              </select>
            </label>
            <label>
              Çalışma modu
              <select
                aria-label="Ödeme çalışma modu"
                value={data.settings.mode}
                onChange={(e) =>
                  setData({
                    ...data,
                    settings: {
                      ...data.settings,
                      mode: e.target.value as Settings["mode"],
                      enabled: false,
                    },
                  })
                }
              >
                <option value="test">Test · gerçek tahsilat yok</option>
                <option value="live">Canlı</option>
              </select>
            </label>
          </div>
          <label className="consent">
            <input
              type="checkbox"
              aria-label="Kartla ödemeyi etkinleştir"
              checked={data.settings.enabled}
              onChange={(e) =>
                setData({
                  ...data,
                  settings: { ...data.settings, enabled: e.target.checked },
                })
              }
            />{" "}
            Kartla ödemeyi etkinleştir
          </label>
          <p>
            <strong>
              {data.settings.enabled ? "Ödeme açık" : "Ödeme kapalı"}
            </strong>{" "}
            · {data.ready ? "Sunucu yapılandırması mevcut" : "Kurulum bekliyor"}
          </p>
          {data.missing.length > 0 && (
            <p>Sunucuda tamamlanacaklar: {data.missing.join(", ")}.</p>
          )}
          <p>
            Mağaza anahtarları bu forma girilmez. PayTR mağaza bilgileri veya
            iyzico test/canlı anahtarları, sunucunun ortam değişkenlerine
            eklenir. Ödeme ayarları içerik yayını ve geri almadan bağımsızdır.
          </p>
          <p>
            PayTR bildirim adresi:
            <br />
            <code>
              {data.callbacks.paytr ||
                "HTTPS site adresi tanımlandıktan sonra görünür."}
            </code>
          </p>
          <p>
            iyzico dönüş adresi:
            <br />
            <code>
              {data.callbacks.iyzico ||
                "HTTPS site adresi tanımlandıktan sonra görünür."}
            </code>
          </p>
          <p className="muted">
            Ödeme başlarken canlı ürünlerin stoku 30 dakika ayrılır. Sonuç, imza
            ve tutar doğrulamasıyla kaydedilir. İade ve itiraz işlemleri
            sağlayıcının panelinden yürütülür.
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? "Kaydediliyor…" : "Ödeme ayarlarını kaydet"}
          </button>
          {message && <p role="status">{message}</p>}
        </>
      )}
    </section>
  );
}
