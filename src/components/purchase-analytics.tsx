"use client";
import { useState } from "react";
import type { PurchaseReport } from "@/lib/purchase-funnel";
import { money } from "@/lib/i18n";
export function PurchaseAnalytics({
  report,
  preview,
}: {
  report?: PurchaseReport;
  preview?: boolean;
}) {
  const [device, setDevice] = useState("Tümü");
  const counts = (device === "Tümü"
    ? report?.counts
    : report?.byDevice.find((d) => d.device === device)?.counts) || [0, 0, 0];
  return (
    <section className="analytics-card purchase-analytics">
      <div className="analytics-card-title">
        <h3>Üründen ödemeye</h3>
        <label>
          Cihaz
          <select
            aria-label="Satın alma akışı cihazı"
            value={device}
            onChange={(e) => setDevice(e.target.value)}
          >
            {["Tümü", "Mobil", "Tablet", "Masaüstü"].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>
      <p>
        Doğrudan ürün sayfasına gelen ziyaretçiler dahil, bu adımları sırayla
        tamamlayan izinli oturumlar. Ödeme formunun içeriği ve tıklama haritası
        kaydedilmez.
      </p>
      <ol className="analytics-funnel">
        {["Ürün incelendi", "Sepete eklendi", "Ödemeye geçildi"].map(
          (label, i) => (
            <li key={label}>
              <div>
                <span>{label}</span>
                <strong data-purchase-count={i}>{counts[i]}</strong>
              </div>
              <div className="funnel-track">
                <i
                  style={{
                    width:
                      (counts[0] ? (counts[i] / counts[0]) * 100 : 0) + "%",
                  }}
                />
              </div>
              <small>
                {i === 0
                  ? "Ürün ziyaretleri"
                  : counts[i - 1]
                    ? `%${Math.round((counts[i] / counts[i - 1]) * 100)} devam etti · ${counts[i - 1] - counts[i]} oturum sonraki adıma geçmedi`
                    : "Henüz veri yok."}
              </small>
            </li>
          ),
        )}
      </ol>
      {!preview && report?.orders ? (
        <div className="purchase-order-summary">
          <h4>Sipariş ve doğrulanmış ödeme</h4>
          <p>
            {report.orders.created} sipariş · {report.orders.paid} doğrulanmış
            ödeme · {money(report.orders.revenue)} tahsilat
          </p>
          <small>
            {report.orders.created
              ? `%${Math.round((report.orders.paid / report.orders.created) * 100)} sipariş ödeme ile tamamlandı.`
              : "Henüz sipariş yok."}{" "}
            Demo/test işlemleri hariçtir. Bu bölüm tüm cihazları ve dönem içinde
            oluşan siparişleri kapsar; izinli ziyaretlerle kişisel eşleştirme
            yapılmaz.
          </small>
        </div>
      ) : (
        <p className="analytics-map-note">
          {preview
            ? "Tasarım önizlemesinde canlı sipariş ve tahsilat sayıları gösterilmez."
            : "Sipariş özeti henüz yüklenmedi."}
        </p>
      )}
    </section>
  );
}
