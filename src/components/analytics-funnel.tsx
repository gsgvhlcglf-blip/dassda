"use client";
import { useState } from "react";
import { funnelLabels, type FunnelReport } from "@/lib/analytics-funnel";
export function AnalyticsFunnel({ report }: { report?: FunnelReport }) {
  const [device, setDevice] = useState("Tümü");
  const counts =
    (device === "Tümü"
      ? report?.counts
      : report?.byDevice.find((d) => d.device === device)?.counts) ||
    Array(6).fill(0);
  return (
    <section className="analytics-card">
      <div className="analytics-card-title">
        <h3>Alışveriş akışı</h3>
        <label>
          Cihaz
          <select
            aria-label="Alışveriş akışı cihazı"
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
        Marka seçimi ekranından başlayıp bu adımları sırayla tamamlayan
        oturumlar. Dönem sonundaki devam eden ziyaretler de henüz tamamlanmamış
        sayılır.
      </p>
      {!counts[0] && (
        <p className="analytics-empty">
          Bu dönem ve cihaz için henüz alışveriş akışı kaydı yok.
        </p>
      )}
      <ol className="analytics-funnel">
        {funnelLabels.map((label, index) => (
          <li key={label}>
            <div>
              <span>
                {String(index + 1).padStart(2, "0")} / {label}
              </span>
              <strong data-funnel-count={index}>{counts[index]}</strong>
            </div>
            <div className="funnel-track">
              <i
                style={{
                  width: counts[0]
                    ? (counts[index] / counts[0]) * 100 + "%"
                    : "0%",
                }}
              />
            </div>
            <small>
              {index === 0
                ? "Akışın başlangıcı"
                : counts[index - 1]
                  ? `${Math.round((counts[index] / counts[index - 1]) * 100)}% önceki adımdan geçti · ${counts[index - 1] - counts[index]} oturum bu adıma ulaşmadı`
                  : "Önceki adımda veri yok."}
            </small>
          </li>
        ))}
      </ol>
      <p className="analytics-map-note">
        Motosiklet seçimi yapmadan ürün inceleyen oturumlar:{" "}
        {report?.directProductSessions || 0} · Bu sayı cihaz filtresinden
        bağımsızdır. Sepete ekleme, başarılı ürün ekleme işlemidir; ödeme veya
        satış anlamına gelmez.
      </p>
    </section>
  );
}
