"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUpRight, Plus } from "lucide-react";
import { money } from "@/lib/i18n";
import {
  requestStages,
  requestInsights,
  originalOptions,
  termsLabels,
  type WorkRequest,
  type RequestTerms,
  type RequestFile,
  type RequestEvent,
  type RequestOperations,
  type TermsKey,
} from "@/lib/requests";
export type RequestDetail = {
  record: WorkRequest;
  history: RequestEvent[];
  files: RequestFile[];
};
export type CRMTransport = {
  load: () => Promise<{
    records: WorkRequest[];
    terms: RequestTerms;
    demo: boolean;
  }>;
  detail: (id: string) => Promise<RequestDetail>;
  act: (record: WorkRequest, action: unknown) => Promise<RequestDetail>;
  terms: (terms: RequestTerms) => Promise<RequestTerms>;
  upload?: (
    id: string,
    files: File[],
  ) => Promise<{ files: RequestFile[]; history: RequestEvent[] }>;
  sample?: () => Promise<void>;
};
async function json(url: string, options?: RequestInit) {
  const r = await fetch(url, { ...options, cache: "no-store" });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "İşlem tamamlanamadı.");
  return data;
}
const api: CRMTransport = {
  load: () => json("/api/admin/requests"),
  detail: (id) => json("/api/admin/requests?id=" + id),
  act: (record, action) =>
    json("/api/admin/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: record.id,
        expectedRevision: record.revision,
        action,
      }),
    }),
  terms: async (terms) =>
    (
      await json("/api/admin/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "terms", terms }),
      })
    ).terms,
  upload: async (id, files) => {
    const form = new FormData();
    form.set("id", id);
    files.forEach((f) => form.append("photos", f));
    return json("/api/admin/requests/files", { method: "POST", body: form });
  },
};
const stamp = (v: string) =>
  v
    ? new Date(v).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })
    : "—";
function status(r: WorkRequest) {
  return (
    (requestStages[r.kind] as Record<string, string>)[r.status] || r.status
  );
}
export function RequestDashboard({
  transport = api,
}: {
  transport?: CRMTransport;
}) {
  const [data, setData] = useState<{
      records: WorkRequest[];
      terms: RequestTerms;
      demo: boolean;
    } | null>(null),
    [selected, setSelected] = useState<RequestDetail | null>(null),
    [tab, setTab] = useState("requests"),
    [search, setSearch] = useState(""),
    [kind, setKind] = useState(""),
    [stage, setStage] = useState(""),
    [days, setDays] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function load() {
    try {
      setError("");
      setData(await transport.load());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Talepler yüklenemedi.");
    }
  }
  useEffect(() => {
    void load();
  }, [transport]);
  async function open(id: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setSelected(await transport.detail(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kayıt açılamadı.");
    } finally {
      setBusy(false);
    }
  }
  async function act(action: unknown) {
    if (!selected) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = await transport.act(selected.record, action);
      setSelected(next);
      setData((old) =>
        old
          ? {
              ...old,
              records: old.records.map((r) =>
                r.id === next.record.id ? next.record : r,
              ),
            }
          : old,
      );
      setMessage("Talep güncellendi. Değişiklik geçmişe kaydedildi.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  }
  const rows = useMemo(() => {
    const limit = days ? Date.now() - Number(days) * 86400000 : 0;
    return (data?.records || []).filter(
      (r) =>
        (!kind || r.kind === kind) &&
        (!stage || r.status === stage) &&
        new Date(r.created_at).getTime() >= limit &&
        `${r.reference} ${r.input.name} ${r.input.email} ${r.input.phone} ${r.input.part_name} ${r.snapshot.brand} ${r.snapshot.model}`
          .toLocaleLowerCase("tr")
          .includes(search.toLocaleLowerCase("tr")),
    );
  }, [data, kind, stage, search, days]);
  const insight = requestInsights(rows),
    today = new Date().toLocaleDateString("sv-SE", {
      timeZone: "Europe/Istanbul",
    });
  const customers = useMemo(() => {
    const contacts = new Map<
      string,
      { name: string; email: string; phone: string; records: WorkRequest[] }
    >();
    for (const r of rows) {
      const key =
        r.input.email.toLowerCase() || r.input.phone.replace(/\D/g, "");
      const c = contacts.get(key) || {
        name: r.input.name,
        email: r.input.email,
        phone: r.input.phone,
        records: [],
      };
      c.records.push(r);
      contacts.set(key, c);
    }
    return [...contacts.values()];
  }, [rows]);
  return (
    <section className="crm-workspace">
      {data?.demo && (
        <p className="crm-notice">
          {transport.sample
            ? "Örnek CRM çalışma alanı · Gerçek müşteri başvuruları canlı yönetim panelinde tutulur. Buraya müşteri bilgisi veya özel dosya girmeyin."
            : "Yerel demo veritabanı · Kayıtlar bu sunucuda tutulur."}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}{" "}
          <button
            type="button"
            className="under-link"
            onClick={() => {
              void load();
              if (selected) void open(selected.record.id);
            }}
          >
            Güncel veriyi yükle
          </button>
        </p>
      )}
      {message && (
        <p className="admin-success" role="status">
          {message}
        </p>
      )}
      {!data ? (
        <p role="status">
          {error ? "Talep verisi yüklenemedi." : "Talepler yükleniyor…"}
        </p>
      ) : selected ? (
        <>
          <button
            className="text-link"
            onClick={() => {
              setSelected(null);
              setMessage("");
              setError("");
            }}
          >
            <ArrowLeft size={16} />
            Tüm talepler
          </button>
          <div className="crm-detail-heading">
            <div>
              <p className="eyebrow">
                {selected.record.reference} /{" "}
                {selected.record.kind === "custom"
                  ? "ÖZEL ÜRETİM"
                  : "YENİ ÜRÜN"}
              </p>
              <h2>{selected.record.input.part_name}</h2>
              <p>
                {selected.record.snapshot.brand}{" "}
                {selected.record.snapshot.model} · {selected.record.input.year}
              </p>
            </div>
            <span className="status-tag">{status(selected.record)}</span>
          </div>
          {selected.record.technical_review && (
            <p className="crm-notice">
              Referans parça şu anda sağlanamıyor / görüşme isteniyor. Teknik
              değerlendirme gerektirir; başvuru kabul edilmiştir.
            </p>
          )}
          <div className="crm-detail-grid">
            <section className="crm-card">
              <h3>Müşteri ve başvuru</h3>
              <dl className="crm-facts">
                <dt>Ad soyad</dt>
                <dd>{selected.record.input.name}</dd>
                <dt>E-posta</dt>
                <dd>
                  {selected.record.input.email ? (
                    <a href={"mailto:" + selected.record.input.email}>
                      {selected.record.input.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
                <dt>Telefon</dt>
                <dd>
                  {selected.record.input.phone ? (
                    <a href={"tel:" + selected.record.input.phone}>
                      {selected.record.input.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
                <dt>İletişim tercihi</dt>
                <dd>
                  {
                    {
                      email: "E-posta",
                      phone: "Telefon",
                      whatsapp: "WhatsApp",
                      either: "E-posta veya telefon",
                    }[selected.record.input.contact]
                  }
                </dd>
                <dt>Şehir / ülke</dt>
                <dd>
                  {[selected.record.input.city, selected.record.input.country]
                    .filter(Boolean)
                    .join(" / ") || "—"}
                </dd>
                <dt>Hesap</dt>
                <dd>
                  {selected.record.customer_id
                    ? "Kayıtlı müşteri"
                    : "Misafir başvuru"}
                </dd>
                <dt>Referans parça</dt>
                <dd>{originalOptions[selected.record.input.original]}</dd>
                <dt>Kategori</dt>
                <dd>{selected.record.snapshot.category || "Belirtilmedi"}</dd>
                <dt>Nesil</dt>
                <dd>{selected.record.snapshot.generation || "—"}</dd>
                <dt>Uzunluk × genişlik</dt>
                <dd>
                  {selected.record.input.length_cm &&
                  selected.record.input.width_cm
                    ? `${selected.record.input.length_cm} × ${selected.record.input.width_cm} cm`
                    : "Eski kayıtta ölçü belirtilmemiş"}
                </dd>
                <dt>Malzeme / yüzey / adet</dt>
                <dd>
                  {
                    {
                      undecided: "Değerlendirilecek",
                      full_carbon: "Tam karbon fiber",
                      hybrid: "Karbon / cam elyaf",
                      forged: "Forged karbon",
                      carbon_finish: "Karbon dış yüzey",
                    }[selected.record.input.material]
                  }{" "}
                  /{" "}
                  {
                    {
                      undecided: "Belirtilmedi",
                      gloss: "Parlak",
                      matte: "Mat",
                    }[selected.record.input.finish]
                  }{" "}
                  / {selected.record.input.quantity ?? "Adet belirtilmedi"}
                </dd>
                <dt>Kaynak sayfa</dt>
                <dd>
                  <a
                    href={selected.record.input.source_path}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Kaynak sayfayı aç <ArrowUpRight size={12} />
                  </a>
                </dd>
                <dt>Başvuru tarihi</dt>
                <dd>{stamp(selected.record.created_at)}</dd>
              </dl>
              <p className="crm-preserve">
                {selected.record.input.part_description}
              </p>
              <p className="crm-preserve">{selected.record.input.other_part}</p>
              <p className="crm-preserve">{selected.record.input.note}</p>
              <h4>Başvuru onay kayıtları</h4>
              <p>Talebin değerlendirilmesi için iletişim izni alındı.</p>
              {selected.record.consents.map((c) => (
                <details key={c.key}>
                  <summary>
                    {termsLabels[c.key]} · v{c.version}
                  </summary>
                  <p className="crm-preserve">{c.text}</p>
                </details>
              ))}
            </section>
            <section className="crm-card">
              <h3>Aşama ve takip</h3>
              <form
                key={selected.record.revision + "status"}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act({
                    type: "status",
                    status: f.get("status"),
                    note: f.get("note"),
                  });
                }}
              >
                <label>
                  Talep aşaması
                  <select
                    aria-label="Talep aşaması"
                    name="status"
                    defaultValue={selected.record.status}
                  >
                    {Object.entries(requestStages[selected.record.kind]).map(
                      ([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Durum değişikliği açıklaması
                  <textarea name="note" required maxLength={6000} />
                </label>
                <p>
                  Aşamalar ileri veya geri alınabilir. Her değişiklik tarihçe
                  oluşturur.
                </p>
                <button className="button" disabled={busy}>
                  Aşamayı kaydet
                </button>
              </form>
              <div className="crm-photo-grid">
                {selected.files.map((f) => (
                  <a
                    key={f.id}
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={f.url}
                      alt={
                        f.kind === "received"
                          ? "Teslim alma fotoğrafı"
                          : "Müşteri referans fotoğrafı"
                      }
                    />
                    <span>
                      {f.kind === "received" ? "Teslim alma" : "Referans"} ·{" "}
                      {f.name}
                    </span>
                  </a>
                ))}
              </div>
              {!selected.files.length && <p>Fotoğraf eklenmemiş.</p>}
              {transport.upload && (
                <label className="crm-upload">
                  Teslim alma fotoğrafları ekle
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    onChange={async (e) => {
                      const files = [...(e.target.files || [])];
                      e.target.value = "";
                      if (!files.length) return;
                      setBusy(true);
                      try {
                        const result = await transport.upload!(
                          selected.record.id,
                          files,
                        );
                        setSelected((old) =>
                          old ? { ...old, ...result } : old,
                        );
                        setMessage("Özel fotoğraflar kaydedildi.");
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Fotoğraf yüklenemedi.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                </label>
              )}
            </section>
          </div>
          <section className="crm-card">
            <h3>
              {selected.record.kind === "custom"
                ? "Referans parça, fiziksel inceleme ve takip"
                : "İç takip ve değerlendirme"}
            </h3>
            <OperationsForm
              key={selected.record.id + ":" + selected.record.revision}
              record={selected.record}
              busy={busy}
              onSave={(operations) =>
                act({ type: "operations", data: operations })
              }
            />
          </section>
          {selected.record.kind === "custom" && (
            <section className="crm-card">
              <h3>Teklifler</h3>
              <p>
                Fiyat teknik değerlendirmeyle belirlenir. Bu ekran otomatik
                fiyat, tahsilat veya müşteri mesajı oluşturmaz. İletim ve
                müşteri onayını, gerçekleştiğinde kanalı ve kanıtıyla kaydedin.
              </p>
              <form
                className="crm-quote-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act({
                    type: "quote",
                    data: {
                      kind: f.get("kind"),
                      amount: Number(f.get("amount")),
                      note: String(f.get("note") || ""),
                      valid_until: String(f.get("valid_until") || ""),
                    },
                  });
                }}
              >
                <label>
                  Teklif türü
                  <select aria-label="Teklif türü" name="kind">
                    <option value="preliminary">Ön teklif</option>
                    <option value="final">Nihai teklif</option>
                  </select>
                </label>
                <label>
                  Tutar (TRY)
                  <input
                    name="amount"
                    type="number"
                    min="0"
                    max="100000000"
                    step="0.01"
                    required
                  />
                </label>
                <label>
                  Geçerlilik tarihi
                  <input name="valid_until" type="date" />
                </label>
                <label>
                  Fiyat ve koşul açıklaması
                  <textarea name="note" maxLength={6000} />
                </label>
                <button className="button" disabled={busy}>
                  Teklif sürümü kaydet
                </button>
              </form>
              {[...selected.record.quotes].reverse().map((q) => (
                <article className="crm-quote" key={q.id}>
                  <div>
                    <strong>
                      v{q.version} ·{" "}
                      {q.kind === "final" ? "Nihai teklif" : "Ön teklif"} ·{" "}
                      {money(q.amount)}
                    </strong>
                    <span>{stamp(q.created_at)}</span>
                    <p className="crm-preserve">{q.note}</p>
                    {q.valid_until && <p>Geçerlilik: {q.valid_until}</p>}
                    <p>
                      {q.sent_at
                        ? "İletim kaydı: " + stamp(q.sent_at)
                        : "Taslak · müşteriye iletim kaydı yok"}
                    </p>
                    {q.accepted_at && (
                      <p>
                        Müşteri onay kaydı: {stamp(q.accepted_at)} ·{" "}
                        {q.acceptance}
                      </p>
                    )}
                  </div>
                  {(!q.sent_at || !q.accepted_at) && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void act({
                          type: q.sent_at ? "quote_accepted" : "quote_sent",
                          quote_id: q.id,
                          note: String(f.get("note") || ""),
                        });
                      }}
                    >
                      <label>
                        {q.sent_at
                          ? "Müşteri onay kanıtı / kanal / tarih"
                          : "İletim kanalı ve tarih kaydı"}
                        <textarea name="note" required maxLength={6000} />
                      </label>
                      <button className="button secondary" disabled={busy}>
                        {q.sent_at
                          ? "Müşteri onayını kaydet"
                          : "İletildi olarak kaydet"}
                      </button>
                    </form>
                  )}
                </article>
              ))}
            </section>
          )}
          <section className="crm-card">
            <h3>Değişiklik geçmişi</h3>
            <ol className="crm-history">
              {selected.history.map((e) => (
                <li key={e.id}>
                  <span>
                    {stamp(e.created_at)} ·{" "}
                    {e.actor === "customer"
                      ? "Müşteri"
                      : e.actor === "local-admin"
                        ? "Yerel yönetici"
                        : "Yönetici"}
                  </span>
                  <strong>
                    {e.type === "status"
                      ? `${(requestStages[selected.record.kind] as Record<string, string>)[e.from_status] || e.from_status} → ${(requestStages[selected.record.kind] as Record<string, string>)[e.to_status] || e.to_status}`
                      : (
                          {
                            created: "Talep alındı",
                            operations:
                              "İnceleme / takip bilgileri güncellendi",
                            quote: "Teklif sürümü oluşturuldu",
                            quote_sent: "Teklif iletimi kaydedildi",
                            quote_accepted: "Müşteri onayı kaydedildi",
                            files: "Teslim alma fotoğrafları eklendi",
                          } as Record<string, string>
                        )[e.type] || e.type}
                  </strong>
                  {e.note && <p>{e.note}</p>}
                  {e.type === "quote" && (
                    <span>Fiyat ve koşullar bu sürümün kaydında korunur.</span>
                  )}
                  {e.type === "operations" && (
                    <OperationChanges detail={e.detail} />
                  )}
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : (
        <>
          <nav className="crm-tabs" aria-label="Talep yönetimi sekmeleri">
            {[
              ["requests", "Başvurular"],
              ["insights", "İş analitiği"],
              ["customers", "Müşteriler"],
              ["terms", "Koşul dokümanları"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={tab === key ? "selected" : ""}
                onClick={() => {
                  setTab(key);
                  setMessage("");
                }}
              >
                {label}
              </button>
            ))}
            {transport.sample && (
              <button
                onClick={async () => {
                  try {
                    await transport.sample!();
                    await load();
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Örnek oluşturulamadı.",
                    );
                  }
                }}
              >
                + Örnek talep ekle
              </button>
            )}
          </nav>
          {tab !== "terms" && (
            <div className="crm-filters">
              <label>
                Talep ara
                <input
                  placeholder="Referans, müşteri, parça veya model"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label>
                Talep türü
                <select
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value);
                    setStage("");
                  }}
                >
                  <option value="">Tümü</option>
                  <option value="custom">Özel üretim</option>
                  <option value="demand">Yeni ürün</option>
                </select>
              </label>
              <label>
                Dönem
                <select value={days} onChange={(e) => setDays(e.target.value)}>
                  <option value="7">Son 7 gün</option>
                  <option value="30">Son 30 gün</option>
                  <option value="90">Son 90 gün</option>
                  <option value="">Tüm zamanlar</option>
                </select>
              </label>
              {kind && (
                <label>
                  Aşama
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                  >
                    <option value="">Tüm aşamalar</option>
                    {Object.entries(
                      requestStages[kind as "custom" | "demand"],
                    ).map(([k, v]) => (
                      <option value={k} key={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          {tab === "requests" && (
            <>
              <div className="crm-stats">
                <div>
                  <span>Toplam başvuru</span>
                  <strong>{insight.total}</strong>
                </div>
                <div>
                  <span>Özel üretim</span>
                  <strong>{insight.custom}</strong>
                </div>
                <div>
                  <span>Yeni ürün talebi</span>
                  <strong>{insight.demand}</strong>
                </div>
                <div>
                  <span>Takibi geciken</span>
                  <strong>
                    {
                      rows.filter(
                        (r) =>
                          r.operations.next_follow_up &&
                          r.operations.next_follow_up < today,
                      ).length
                    }
                  </strong>
                </div>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Başvuru / parça</th>
                      <th>Motosiklet</th>
                      <th>Müşteri</th>
                      <th>Aşama / takip</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong>{r.input.part_name}</strong>
                          <small>
                            {r.reference} ·{" "}
                            {r.kind === "custom" ? "Özel üretim" : "Yeni ürün"}
                          </small>
                        </td>
                        <td>
                          {r.snapshot.brand} {r.snapshot.model}
                          <small>{r.input.year}</small>
                        </td>
                        <td>
                          {r.input.name}
                          <small>{r.input.email || r.input.phone}</small>
                        </td>
                        <td>
                          <span className="status-tag">{status(r)}</span>
                          {r.technical_review && (
                            <small>Teknik inceleme gerekli</small>
                          )}
                          {r.operations.next_follow_up && (
                            <small>Takip: {r.operations.next_follow_up}</small>
                          )}
                        </td>
                        <td>
                          <button
                            className="text-link"
                            disabled={busy}
                            onClick={() => void open(r.id)}
                          >
                            Talebi aç <ArrowUpRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!rows.length && (
                <p className="empty">Bu filtrelerde talep bulunmuyor.</p>
              )}
            </>
          )}
          {tab === "insights" && (
            <>
              <div className="crm-stats">
                <div>
                  <span>Farklı iletişim kaydı</span>
                  <strong>{customers.length}</strong>
                </div>
                <div>
                  <span>Teknik değerlendirme</span>
                  <strong>{insight.technical}</strong>
                </div>
                <div>
                  <span>Son tekliflerin toplamı</span>
                  <strong>{money(insight.quoteTotal)}</strong>
                  <small>Tahsilat / ciro değildir.</small>
                </div>
              </div>
              <div className="crm-insights">
                {[
                  ["En çok talep edilen modeller", insight.byModel],
                  ["Talep edilen parçalar", insight.byPart],
                  ["Aşama dağılımı", insight.byStatus],
                ].map(([title, values]) => (
                  <section className="crm-card" key={String(title)}>
                    <h3>{String(title)}</h3>
                    {(values as typeof insight.byPart).map((v) => (
                      <div className="crm-ranking" key={v.name}>
                        <span>{v.name}</span>
                        <strong>{v.count}</strong>
                        <small>{v.customers} farklı iletişim kaydı</small>
                      </div>
                    ))}
                    {!(values as unknown[]).length && <p>Henüz veri yok.</p>}
                  </section>
                ))}
              </div>
              <p className="muted">
                Sıralama seçilen dönemdeki gerçek başvurulardan hesaplanır. Aynı
                iletişim bilgisinin tekrar başvuruları ayrıca sayılır; farklı
                müşteri sayısı e-posta veya telefon üzerinden gruplanır.
              </p>
            </>
          )}
          {tab === "customers" && (
            <div className="crm-customer-grid">
              {customers.map((c) => (
                <section className="crm-card" key={c.email || c.phone}>
                  <h3>{c.name}</h3>
                  <p>{c.email || "—"}</p>
                  <p>{c.phone || "—"}</p>
                  <p>{c.records.length} başvuru</p>
                  {c.records.map((r) => (
                    <button
                      key={r.id}
                      className="text-link"
                      onClick={() => void open(r.id)}
                    >
                      {r.reference} · {r.input.part_name}{" "}
                      <ArrowUpRight size={12} />
                    </button>
                  ))}
                </section>
              ))}
            </div>
          )}
          {tab === "terms" && (
            <TermsEditor
              key={data.terms.version}
              value={data.terms}
              busy={busy}
              onSave={async (terms) => {
                setBusy(true);
                setError("");
                try {
                  const saved = await transport.terms(terms);
                  setData((old) => (old ? { ...old, terms: saved } : old));
                  setMessage(
                    "Koşullar yeni bir sürüm olarak kaydedildi. Önceki onay kayıtları korunur.",
                  );
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Koşullar kaydedilemedi.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
function OperationChanges({ detail }: { detail: unknown }) {
  const data = detail as {
    before?: RequestOperations;
    after?: RequestOperations;
  };
  if (!data?.before || !data.after) return null;
  const labels: Record<string, string> = {
    owner: "Parça sahibi",
    shipping_authorized: "Gönderim onayı",
    consent_evidence: "Müşteri onay kaydı",
    consent_date: "Onay tarihi",
    terms_snapshot: "Koşul sürümü",
    shipping_instructions: "Gönderim koşulları",
    inbound_carrier: "Gelen kargo firması",
    inbound_tracking: "Gelen takip numarası",
    received_date: "Teslim tarihi",
    condition: "Yüzey durumu",
    damage: "Hasar kaydı",
    inspection: "Fiziksel inceleme",
    return_required: "İade durumu",
    return_carrier: "İade firması",
    return_tracking: "İade takip numarası",
    returned_date: "İade tarihi",
    next_follow_up: "Takip tarihi",
    internal_note: "İç not",
  };
  const text = (v: unknown) =>
    typeof v === "boolean"
      ? v
        ? "Evet"
        : "Hayır"
      : v && typeof v === "object"
        ? "Sürüm " + (v as RequestTerms).version
        : String(v || "—");
  return (
    <details>
      <summary>Değişen bilgileri gör</summary>
      {Object.keys(labels)
        .filter(
          (k) =>
            JSON.stringify(data.before![k as keyof RequestOperations]) !==
            JSON.stringify(data.after![k as keyof RequestOperations]),
        )
        .map((k) => (
          <p key={k}>
            <strong>{labels[k]}</strong>
            {text(data.before![k as keyof RequestOperations])} →{" "}
            {text(data.after![k as keyof RequestOperations])}
          </p>
        ))}
    </details>
  );
}
function OperationsForm({
  record,
  busy,
  onSave,
}: {
  record: WorkRequest;
  busy: boolean;
  onSave: (value: RequestOperations) => void;
}) {
  const ops = record.operations;
  const field = (
    key: keyof RequestOperations,
    label: string,
    type = "text",
  ) => (
    <label key={key}>
      {label}
      {type === "textarea" ? (
        <textarea
          name={key}
          defaultValue={String(ops[key] || "")}
          maxLength={6000}
        />
      ) : (
        <input
          name={key}
          type={type}
          defaultValue={String(ops[key] || "")}
          maxLength={200}
        />
      )}
    </label>
  );
  return (
    <form
      className="crm-operations"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const value = { ...ops };
        for (const k of Object.keys(ops) as (keyof RequestOperations)[]) {
          if (k === "terms_snapshot") continue;
          (value as unknown as Record<string, unknown>)[k] =
            k === "shipping_authorized"
              ? f.has(k)
              : String(f.get(k) ?? ops[k] ?? "");
        }
        onSave(value);
      }}
    >
      <div className="request-field-grid">
        {field("next_follow_up", "Sonraki takip tarihi", "date")}
        {field("internal_note", "İç değerlendirme notu", "textarea")}
      </div>
      {record.kind === "custom" && (
        <>
          <div className="request-field-grid">
            <label>
              Referans parçanın sahibi
              <select
                aria-label="Referans parçanın sahibi"
                name="owner"
                defaultValue={ops.owner}
              >
                <option value="unknown">Henüz doğrulanmadı</option>
                <option value="customer">Müşteriye ait</option>
                <option value="third_party">Üçüncü kişiye ait</option>
              </select>
            </label>
            {field("consent_date", "Müşteri onay tarihi", "date")}
            {field(
              "consent_evidence",
              "Müşteri onay kaydı / kanıtı",
              "textarea",
            )}
            {field(
              "shipping_instructions",
              "İletilen gönderim koşulları",
              "textarea",
            )}
          </div>
          <label className="request-check">
            <input
              type="checkbox"
              name="shipping_authorized"
              defaultChecked={ops.shipping_authorized}
            />
            Koşullar müşteriye iletildi; müşteri onayı kaydedildi ve referans
            parça gönderimine izin verildi.
          </label>
          <p>
            Gönderim onayından önce Koşul dokümanları bölümündeki mülkiyet,
            risk, iade ve kalıp kullanım metinlerini hazırlayın. Hukuki / ticari
            metinler sizin onayınız olmadan yayımlanmaz.
          </p>
          <div className="request-field-grid">
            {field("inbound_carrier", "Gelen kargo firması")}
            {field("inbound_tracking", "Gelen kargo takip numarası")}
            {field("received_date", "Teslim alınma tarihi", "date")}
            {field("condition", "Yüzey / mevcut durum", "textarea")}
            {field("damage", "Mevcut hasar kaydı", "textarea")}
            {field("inspection", "Fiziksel inceleme notları", "textarea")}
            <label>
              Referans parça iade edilecek mi?
              <select
                aria-label="Referans parça iade edilecek mi?"
                name="return_required"
                defaultValue={ops.return_required}
              >
                <option value="unknown">Henüz kararlaştırılmadı</option>
                <option value="yes">Evet</option>
                <option value="no">Hayır</option>
              </select>
            </label>
            {field("return_carrier", "İade kargo firması")}
            {field("return_tracking", "İade takip numarası")}
            {field("returned_date", "İade gönderim tarihi", "date")}
          </div>
          {ops.terms_snapshot && (
            <details>
              <summary>
                Gönderim onayında kullanılan koşullar · v
                {ops.terms_snapshot.version}
              </summary>
              {Object.entries(ops.terms_snapshot.documents).map(([k, v]) => (
                <div key={k}>
                  <h4>{termsLabels[k as TermsKey]}</h4>
                  <p className="crm-preserve">{v.text}</p>
                </div>
              ))}
            </details>
          )}
        </>
      )}
      <button className="button" disabled={busy}>
        Takip bilgilerini kaydet
      </button>
    </form>
  );
}
function TermsEditor({
  value,
  busy,
  onSave,
}: {
  value: RequestTerms;
  busy: boolean;
  onSave: (v: RequestTerms) => void;
}) {
  return (
    <section className="crm-card">
      <p className="eyebrow">DÜZENLENEBİLİR KOŞULLAR / v{value.version}</p>
      <h3>Koşul dokümanları</h3>
      <p>
        Metinler işletmeniz tarafından hazırlanmalı ve onaylanmalıdır. Boş
        taslaklar müşteriye gösterilmez. Onaylı sürümler başvuruda veya gönderim
        onayında kopyalanır; sonraki değişiklikler eski kayıtları değiştirmez.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const documents = structuredClone(value.documents);
          for (const key of Object.keys(termsLabels) as TermsKey[])
            documents[key] = {
              text: String(f.get(key) || ""),
              approved: f.has(key + "_approved"),
            };
          onSave({ version: value.version, documents });
        }}
      >
        {Object.entries(termsLabels).map(([key, label]) => (
          <fieldset key={key}>
            <legend>{label}</legend>
            <textarea
              aria-label={label + " metni"}
              name={key}
              defaultValue={value.documents[key as TermsKey].text}
              maxLength={16000}
              rows={6}
            />
            <label className="request-check">
              <input
                type="checkbox"
                name={key + "_approved"}
                defaultChecked={value.documents[key as TermsKey].approved}
              />
              Bu metni kontrol ettim ve kullanıma onaylıyorum.
            </label>
          </fieldset>
        ))}
        <button className="button" disabled={busy}>
          Koşul sürümünü kaydet
        </button>
      </form>
    </section>
  );
}
