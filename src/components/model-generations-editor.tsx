"use client";
import type { GenerationInput } from "@/lib/model-generations";

export function ModelGenerationsEditor({
  value,
  onChange,
}: {
  value: GenerationInput[];
  onChange: (value: GenerationInput[]) => void;
}) {
  function add() {
    onChange([
      ...value,
      { id: crypto.randomUUID(), name: "", start_year: "", end_year: "" },
    ]);
  }
  function update(index: number, key: keyof GenerationInput, entry: string) {
    onChange(
      value.map((row, i) =>
        i === index
          ? {
              ...row,
              [key]: key === "name" ? entry : entry === "" ? "" : Number(entry),
            }
          : row,
      ),
    );
  }
  return (
    <section
      className="generation-editor"
      aria-label="Nesiller ve yıl aralıkları"
    >
      <div className="generation-editor-heading">
        <div>
          <h3>Nesiller ve yıl aralıkları</h3>
          <p>Her nesil için ayrı yıl aralığı ve açıklama ekleyin.</p>
        </div>
        <button type="button" className="button secondary" onClick={add}>
          + Yıl aralığı ekle
        </button>
      </div>
      {!value.length && (
        <p className="help">
          Henüz yıl aralığı yok. Eklediğiniz aralıktaki tüm yıllar otomatik
          oluşturulur.
        </p>
      )}
      {value.map((row, index) => (
        <fieldset className="generation-editor-row" key={row.id}>
          <legend>{index + 1}. yıl aralığı</legend>
          <label>
            Başlangıç yılı
            <input
              aria-label={`Başlangıç yılı ${index + 1}`}
              type="number"
              min="1900"
              max="2100"
              step="1"
              required
              value={row.start_year}
              onChange={(e) => update(index, "start_year", e.target.value)}
            />
          </label>
          <label>
            Bitiş yılı
            <input
              aria-label={`Bitiş yılı ${index + 1}`}
              type="number"
              min="1900"
              max="2100"
              step="1"
              required
              value={row.end_year}
              onChange={(e) => update(index, "end_year", e.target.value)}
            />
          </label>
          <label className="generation-description">
            Nesil açıklaması
            <input
              aria-label={`Nesil açıklaması ${index + 1}`}
              maxLength={200}
              required
              placeholder="Örn. 1. nesil · ilk kasa"
              value={row.name}
              onChange={(e) => update(index, "name", e.target.value)}
            />
          </label>
          <button
            type="button"
            className="under-link"
            aria-label={`${index + 1}. yıl aralığını kaldır`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            Kaldır
          </button>
        </fieldset>
      ))}
      <p className="help">
        Aralıklar çakışamaz. Değiştirilen aralıktaki tüm yıllar eklenir. Mevcut
        parça eşleştirmeleri yılları korunarak yeni nesillere ayrılır;
        uyumluluğu olan yıllar kapsam dışında bırakılamaz.
      </p>
    </section>
  );
}
