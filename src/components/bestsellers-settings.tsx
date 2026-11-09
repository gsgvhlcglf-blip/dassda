"use client";
import { useState } from "react";
import {
  visibleBestsellers,
  centeredBestsellerFrame,
  type BestsellersConfig,
} from "@/lib/bestsellers";
import type { Catalog } from "@/lib/types";
export function BestsellersSettings({
  catalog,
  onSave,
}: {
  catalog: Catalog;
  onSave: (value: BestsellersConfig) => Promise<void>;
}) {
  const [value, setValue] = useState(() => visibleBestsellers(catalog)),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(value.productIds[0] || ""),
    [guides, setGuides] = useState(true),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  const activeId = value.productIds.includes(selected)
    ? selected
    : value.productIds[0] || "";
  const frame = value.frames[activeId] || centeredBestsellerFrame;
  function changeFrame(field: "scale" | "x" | "y", number: number) {
    if (activeId)
      setValue((v) => ({
        ...v,
        frames: {
          ...v.frames,
          [activeId]: {
            ...(v.frames[activeId] || centeredBestsellerFrame),
            [field]: number,
          },
        },
      }));
    setStatus("");
  }
  function toggle(id: string) {
    setStatus("");
    setValue((v) => ({
      ...v,
      productIds: v.productIds.includes(id)
        ? v.productIds.filter((p) => p !== id)
        : v.productIds.length < 10
          ? [...v.productIds, id]
          : v.productIds,
    }));
    if (!selected) setSelected(id);
  }
  function shift(id: string, by: number) {
    setValue((v) => {
      const ids = [...v.productIds],
        i = ids.indexOf(id),
        j = i + by;
      if (j < 0 || j >= ids.length) return v;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      return { ...v, productIds: ids };
    });
    setStatus("");
  }
  async function save() {
    setBusy(true);
    setStatus("");
    try {
      const saved = value.productIds.length
        ? value
        : { ...value, hidden: true };
      await onSave(saved);
      setValue(saved);
      setStatus("Kaydedildi · Ana sayfa güncellendi.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="bestsellers-settings">
      <h2>En çok satanlar</h2>
      <label>
        <input
          type="checkbox"
          checked={!value.hidden}
          onChange={(event) =>
            setValue((current) => ({
              ...current,
              hidden: !event.target.checked,
            }))
          }
        />
        Vitrini göster
      </label>
      <button
        type="button"
        className="button secondary"
        onClick={() =>
          setValue((current) => ({
            ...current,
            hidden: false,
            productIds: catalog.products
              .filter((product) => product.published)
              .slice(0, 3)
              .map((product) => product.id),
          }))
        }
      >
        Üçlü vitrini geri getir
      </button>
      <p>
        Vitrinde en fazla 10 ürün seç. Masaüstünde üçü yan yana görünür; dört
        veya daha fazlası otomatik ilerler. Sıralamayı sen belirlersin.
      </p>
      <p>
        Fotoğrafları önizlemede üzerlerine tıklayarak değiştirebilirsin.
        Düzenleme modunda vitrin sabit kalır; müşteri önizlemesinde otomatik
        ilerler.
      </p>
      <label>
        Ürün ara
        <input
          aria-label="Vitrin ürünlerini ara"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ürün adı veya SKU"
        />
      </label>
      <p className="bestsellers-count">
        {value.productIds.length} / 10 ürün seçildi
      </p>
      <div className="bestsellers-picker">
        {catalog.products
          .filter((p) =>
            (p.title.tr + " " + p.sku)
              .toLocaleLowerCase("tr")
              .includes(search.toLocaleLowerCase("tr")),
          )
          .map((p) => (
            <label key={p.id}>
              <input
                type="checkbox"
                aria-label={"Vitrine ekle: " + p.title.tr}
                checked={value.productIds.includes(p.id)}
                disabled={
                  busy ||
                  (!value.productIds.includes(p.id) &&
                    value.productIds.length >= 10)
                }
                onChange={() => toggle(p.id)}
              />
              <span>
                {p.title.tr}
                <small>
                  {p.sku}
                  {!p.published ? " · Yayında değil, vitrinde gösterilmez" : ""}
                  {p.demo ? " · Örnek ürün" : ""}
                </small>
              </span>
            </label>
          ))}
      </div>
      <h3>Gösterim sırası</h3>
      <ol className="bestsellers-order">
        {value.productIds.map((id, i) => {
          const p = catalog.products.find((p) => p.id === id);
          return (
            <li key={id}>
              <span>{p?.title.tr || "Silinmiş ürün"}</span>
              <button
                type="button"
                aria-label={(p?.title.tr || id) + " yukarı"}
                disabled={i === 0 || busy}
                onClick={() => shift(id, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={(p?.title.tr || id) + " aşağı"}
                disabled={i === value.productIds.length - 1 || busy}
                onClick={() => shift(id, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={(p?.title.tr || id) + " vitrinden çıkar"}
                onClick={() => toggle(id)}
              >
                Çıkar
              </button>
            </li>
          );
        })}
      </ol>
      <label>
        Otomatik geçiş aralığı
        <select
          aria-label="Karusel geçiş süresi"
          value={value.intervalSeconds}
          onChange={(e) => {
            setValue((v) => ({
              ...v,
              intervalSeconds: Number(e.target.value),
            }));
            setStatus("");
          }}
        >
          {[3, 4, 5, 6, 8, 10, 15, 20].map((n) => (
            <option value={n} key={n}>
              {n} saniye
            </option>
          ))}
        </select>
      </label>
      {!!value.productIds.length && (
        <section className="bestsellers-frame-editor">
          <h3>Görsel hizalama ve ölçek</h3>
          <label>
            Düzenlenecek ürün
            <select
              aria-label="Vitrin kadrajı ürünü"
              value={
                value.productIds.includes(selected)
                  ? selected
                  : value.productIds[0]
              }
              onChange={(e) => setSelected(e.target.value)}
            >
              {value.productIds.map((id) => (
                <option key={id} value={id}>
                  {catalog.products.find((p) => p.id === id)?.title.tr || id}
                </option>
              ))}
            </select>
          </label>
          <div
            className={`bestsellers-frame-preview${guides ? " guides" : ""}`}
          >
            <img
              src={
                catalog.product_images
                  .filter((i) => i.product_id === activeId)
                  .sort((a, b) => a.position - b.position)[0]?.url ||
                "/images/part-0.svg"
              }
              alt="Vitrin kadrajı önizlemesi"
              style={{
                objectPosition: frame.x + "% " + frame.y + "%",
                transform: `translate(${(frame.x - 50) / 2}%,${(frame.y - 50) / 2}%) scale(${frame.scale / 100})`,
              }}
            />
          </div>
          {(
            [
              ["scale", "Ölçek", 50, 200],
              ["x", "Yatay konum", 0, 100],
              ["y", "Dikey konum", 0, 100],
            ] as const
          ).map(([field, label, min, max]) => (
            <label key={field}>
              {label} · {frame[field]}
              {field === "scale" ? "%" : ""}
              <input
                type="range"
                aria-label={"Vitrin " + label.toLocaleLowerCase("tr")}
                min={min}
                max={max}
                value={frame[field]}
                onChange={(e) => changeFrame(field, Number(e.target.value))}
              />
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={guides}
              onChange={(e) => setGuides(e.target.checked)}
            />
            Hizalama kılavuzu
          </label>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setValue((v) => ({
                ...v,
                frames: Object.fromEntries(
                  v.productIds.map((id) => [
                    id,
                    {
                      scale: frame.scale,
                      x: 50,
                      y: 50,
                      role: "overview" as const,
                    },
                  ]),
                ),
              }));
              setStatus("");
            }}
          >
            Hepsini ortala
          </button>
          <p>
            Seçili ölçeği tüm vitrin ürünlerine uygular ve görselleri ortalar.
            Ayarlar yalnızca bu vitrin alanını etkiler.
          </p>
        </section>
      )}
      <button type="button" className="button" disabled={busy} onClick={save}>
        {busy ? "Kaydediliyor…" : "Vitrini kaydet"}
      </button>
      {status && <p role="status">{status}</p>}
    </div>
  );
}
