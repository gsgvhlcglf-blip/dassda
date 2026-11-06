"use client";
import type { Catalog } from "@/lib/types";
import type { CompatibilityInput } from "@/lib/product-compatibility";

export function ProductCompatibilityEditor({
  catalog: c,
  value,
  onChange,
}: {
  catalog: Catalog;
  value: CompatibilityInput[];
  onChange: (value: CompatibilityInput[]) => void;
}) {
  function change(index: number, patch: Partial<CompatibilityInput>) {
    onChange(value.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  return (
    <section
      className="generation-editor product-compatibility-editor"
      aria-label="Uyumlu modeller ve yıllar"
    >
      <div className="generation-editor-heading">
        <div>
          <h3>Uyumlu modeller ve yıllar</h3>
          <p>Aynı parçayı farklı marka, model ve yıllarla eşleştirin.</p>
        </div>
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            onChange([
              ...value,
              {
                id: crypto.randomUUID(),
                brand_id: "",
                model_id: "",
                generation_id: null,
                year_from: "",
                year_to: "",
              },
            ])
          }
        >
          + Uyumlu model ekle
        </button>
      </div>
      {!value.length && (
        <p className="help">
          Henüz uyumluluk eklenmemiş. Model bazlı listelerde görünmesi için
          doğruladığınız modelleri ve yılları ekleyin.
        </p>
      )}
      {value.map((row, i) => {
        const models = c.models.filter((m) => m.brand_id === row.brand_id);
        const groups = c.generations
          .filter((g) => g.model_id === row.model_id)
          .sort((a, b) => a.start_year - b.start_year);
        const years = [
          ...new Set(
            c.model_years
              .filter(
                (y) =>
                  y.model_id === row.model_id &&
                  (!row.generation_id || y.generation_id === row.generation_id),
              )
              .map((y) => y.year),
          ),
        ].sort((a, b) => a - b);
        const yearOptions = (selected: number | "") => (
          <>
            <option value="">Yıl seçin…</option>
            {selected !== "" && !years.includes(selected) && (
              <option value={selected}>{selected} · mevcut kayıt</option>
            )}
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </>
        );
        return (
          <fieldset className="generation-editor-row" key={row.id}>
            <legend>{i + 1}. uyumluluk</legend>
            <label>
              Marka
              <select
                aria-label={`Uyumlu marka ${i + 1}`}
                required
                value={row.brand_id}
                onChange={(e) =>
                  change(i, {
                    brand_id: e.target.value,
                    model_id: "",
                    generation_id: null,
                    year_from: "",
                    year_to: "",
                  })
                }
              >
                <option value="">Marka seçin…</option>
                {c.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Model
              <select
                aria-label={`Uyumlu model ${i + 1}`}
                required
                disabled={!row.brand_id}
                value={row.model_id}
                onChange={(e) =>
                  change(i, {
                    model_id: e.target.value,
                    generation_id: null,
                    year_from: "",
                    year_to: "",
                  })
                }
              >
                <option value="">Model seçin…</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.published === false ? " · yayında değil" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="generation-description">
              Nesil / yıl grubu
              <select
                aria-label={`Uyumlu nesil ${i + 1}`}
                disabled={!row.model_id}
                value={row.generation_id || ""}
                onChange={(e) => {
                  const id = e.target.value;
                  const ys = c.model_years
                    .filter(
                      (y) =>
                        y.model_id === row.model_id && y.generation_id === id,
                    )
                    .map((y) => y.year)
                    .sort((a, b) => a - b);
                  change(i, {
                    generation_id: id || null,
                    year_from: "",
                    year_to: "",
                    ...(id
                      ? { year_from: ys[0] ?? "", year_to: ys.at(-1) ?? "" }
                      : {}),
                  });
                }}
              >
                <option value="">Yılları kendim seçeceğim</option>
                {groups.map((g) => (
                  <option
                    key={g.id}
                    value={g.id}
                    disabled={
                      !c.model_years.some(
                        (y) =>
                          y.generation_id === g.id &&
                          y.model_id === row.model_id,
                      )
                    }
                  >
                    {g.start_year}–{g.end_year} · {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Başlangıç yılı
              <select
                aria-label={`Uyumlu başlangıç yılı ${i + 1}`}
                required
                disabled={!row.model_id}
                value={row.year_from}
                onChange={(e) =>
                  change(i, {
                    year_from:
                      e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              >
                {yearOptions(row.year_from)}
              </select>
            </label>
            <label>
              Bitiş yılı
              <select
                aria-label={`Uyumlu bitiş yılı ${i + 1}`}
                required
                disabled={!row.model_id}
                value={row.year_to}
                onChange={(e) =>
                  change(i, {
                    year_to:
                      e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              >
                {yearOptions(row.year_to)}
              </select>
            </label>
            {row.model_id && !years.length && (
              <p className="generation-description help">
                Bu model / nesil için üretim yılı tanımlanmamış. Önce motosiklet
                düzenleme ekranından yılları ekleyin.
              </p>
            )}
            <button
              type="button"
              className="under-link"
              aria-label={`${i + 1}. uyumluluğu kaldır`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              Kaldır
            </button>
          </fieldset>
        );
      })}
      <p className="help">
        Yalnızca doğruladığınız uyumlulukları girin. Nesil seçmek o neslin
        kayıtlı yıllarını doldurur; isterseniz aralığı daraltın. Yıllar
        motosiklet kayıtlarından gelir. Ürünle birlikte kaydedilir; müşteri
        görünümüne geçirmek için taslağı yayınlayın.
      </p>
    </section>
  );
}
