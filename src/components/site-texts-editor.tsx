"use client";
import { useEffect, useMemo, useState } from "react";
import { siteTextEntries } from "@/lib/site-texts";
import type { VisualDesign } from "@/lib/visual";

export function SiteTextsEditor({
  design,
  onSave,
}: {
  design: VisualDesign;
  onSave: (key: string, value: string | null) => void | Promise<void>;
}) {
  const [query, setQuery] = useState(""),
    [group, setGroup] = useState("");
  const entries = useMemo(() => siteTextEntries("tr", design), [design]);
  const [selected, setSelected] = useState("slot:request.custom.note");
  const entry = entries.find((row) => row.key === selected);
  const [draft, setDraft] = useState(entry?.value || ""),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState("");
  useEffect(() => {
    setDraft(entry?.value ?? "");
  }, [selected, entry?.value]);
  useEffect(() => setFeedback(""), [selected]);
  const filtered = entries.filter(
    (row) =>
      (!group || row.group === group) &&
      `${row.label} ${row.value}`
        .toLocaleLowerCase("tr")
        .includes(query.toLocaleLowerCase("tr")),
  );
  async function save(value: string | null) {
    setBusy(true);
    setFeedback("");
    try {
      await onSave(selected, value);
      setDraft(value ?? entry?.fallback ?? "");
      setFeedback(value === "" ? "Metin kaldırıldı." : "Metin kaydedildi.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="site-texts-editor">
      <p>
        Başlıkları, açıklamaları, menüleri, düğmeleri ve form yazılarını kendin
        düzenleyebilirsin. Boş metin, müşteri görünümünde yazıyı kaldırır. Sayfa
        ve ürün içerikleri önizlemede kendi kayıtlarından düzenlenir.
      </p>
      <div className="site-texts-filters">
        <input
          type="search"
          aria-label="Site metinlerinde ara"
          placeholder="Bir metin ara…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Metin bölümü"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        >
          <option value="">Tüm bölümler</option>
          {[...new Set(entries.map((row) => row.group))].sort().map((label) => (
            <option key={label}>{label}</option>
          ))}
        </select>
      </div>
      <div className="site-texts-layout">
        <div
          className="site-texts-list"
          role="group"
          aria-label="Düzenlenebilir site metinleri"
        >
          {filtered.map((row) => (
            <button
              type="button"
              key={row.key}
              aria-pressed={selected === row.key}
              onClick={() => {
                if (!busy) setSelected(row.key);
              }}
            >
              <small>
                {row.group}
                {row.value === "" ? " · Kaldırılmış" : ""}
              </small>
              <span>{row.label}</span>
            </button>
          ))}
          {!filtered.length && <p role="status">Aramana uygun metin yok.</p>}
        </div>
        {entry && (
          <div className="site-texts-detail">
            <h3>{entry.group}</h3>
            <p>{entry.label}</p>
            <label>
              Metin
              <textarea
                aria-label="Site metnini düzenle"
                disabled={busy}
                value={draft}
                maxLength={12000}
                rows={7}
                onChange={(e) => setDraft(e.target.value)}
              />
            </label>
            <div className="site-texts-actions">
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => void save(draft)}
              >
                {busy ? "Kaydediliyor…" : "Metni kaydet"}
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => void save("")}
              >
                Metni kaldır
              </button>
              <button
                type="button"
                className="under-link"
                disabled={busy}
                onClick={() => void save(null)}
              >
                Varsayılanı geri getir
              </button>
            </div>
            {feedback && <p role="status">{feedback}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
