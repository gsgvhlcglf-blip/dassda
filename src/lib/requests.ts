import { z } from "zod";
import type { Catalog } from "./types";

export const requestStages = {
  demand: {
    new: "Yeni Talep",
    review: "Değerlendiriliyor",
    planned: "Ürün Geliştirme Planında",
    prototype: "Prototip / Kalıp Geliştirme",
    available: "Ürün Satışta",
    informed: "Müşteriye Bilgi Verildi",
    closed: "Kapandı / Reddedildi",
  },
  custom: {
    new: "Talep Alındı",
    review: "Ön İnceleme",
    preparing_quote: "Ön Teklif Hazırlanıyor",
    quote_sent: "Ön Teklif Gönderildi",
    awaiting_approval: "Müşteri Onayı Bekleniyor",
    awaiting_part: "Referans Parça Bekleniyor",
    part_in_transit: "Referans Parça Kargoda",
    part_received: "Referans Parça Teslim Alındı",
    physical_review: "Fiziksel Kontrol ve Nihai Değerlendirme",
    final_approval: "Nihai Fiyat / Koşul Onayı",
    scheduled: "Üretim Planlandı",
    mould: "Kalıp Hazırlanıyor",
    production: "Karbonfiber Üretimi",
    quality: "Kalite Kontrol",
    ready: "Sevkiyata Hazır",
    shipped: "Sevk Edildi",
    completed: "Tamamlandı",
    cancelled: "İptal Edildi",
    unsuitable: "Teknik Olarak Uygun Değil",
    awaiting_reply: "Müşteriden Cevap Bekleniyor",
  },
};
export type RequestKind = keyof typeof requestStages;
export const originalOptions = {
  can_ship: "Orijinal parçam var ve gönderebilirim.",
  on_bike: "Parçam motosiklet üzerinde, gerekirse sağlayabilirim.",
  unavailable: "Orijinal parçaya erişimim yok / şu an sağlayamam.",
  discuss: "Görüşmek istiyorum.",
};
export const termsLabels = {
  ownership: "Referans parçanın mülkiyeti",
  damage: "Hasar ve risk koşulları",
  returns: "İade koşulları",
  mould: "Kalıp kullanım hakları",
};
export type TermsKey = keyof typeof termsLabels;
export type RequestTerms = {
  version: number;
  documents: Record<TermsKey, { text: string; approved: boolean }>;
};
export const blankTerms: RequestTerms = {
  version: 0,
  documents: {
    ownership: { text: "", approved: false },
    damage: { text: "", approved: false },
    returns: { text: "", approved: false },
    mould: { text: "", approved: false },
  },
};
const line = z.string().trim().max(200),
  notes = z.string().trim().max(6000);
export const requestSchema = z
  .object({
    submission_key: z.string().uuid(),
    kind: z.enum(["custom", "demand"]),
    brand_id: z.enum(["ducati", "bmw", "yamaha"]),
    model_id: line.min(1),
    year: z.number().int().min(1900).max(2100),
    generation_id: line.optional().default(""),
    category_id: line.optional().default(""),
    product_id: line.optional().default(""),
    part_name: line.min(2),
    part_description: notes.default(""),
    other_part: notes.default(""),
    material: z
      .enum(["undecided", "full_carbon", "hybrid", "forged", "carbon_finish"])
      .default("undecided"),
    finish: z.enum(["undecided", "gloss", "matte"]).default("undecided"),
    quantity: z.number().int().min(1).max(1000).default(1),
    original: z.enum(["can_ship", "on_bike", "unavailable", "discuss"]),
    name: line.min(2),
    email: z.union([z.literal(""), z.email().max(254)]).default(""),
    phone: z
      .string()
      .trim()
      .max(30)
      .refine(
        (v) => !v || /^[+\d\s().-]{7,30}$/.test(v),
        "Telefon numarasını kontrol edin.",
      )
      .default(""),
    contact: z.enum(["email", "phone", "whatsapp", "either"]).default("either"),
    city: line.default(""),
    country: line.default(""),
    note: notes.default(""),
    source_path: z.string().max(2000).default("/parcani-urettir"),
    permission: z.literal(true),
    accepted_terms: z
      .array(z.enum(["ownership", "damage", "returns", "mould"]))
      .max(4)
      .default([]),
    terms_version: z.number().int().min(0).default(0),
    website: z.string().max(0).default(""),
  })
  .refine(
    (v) => !!(v.email || v.phone),
    "E-posta veya telefon bilgilerinden en az birini girin.",
  )
  .refine(
    (v) => v.contact !== "email" || !!v.email,
    "E-posta ile iletişim için e-posta adresinizi girin.",
  )
  .refine(
    (v) => !["phone", "whatsapp"].includes(v.contact) || !!v.phone,
    "Seçtiğiniz iletişim kanalı için telefon girin.",
  )
  .refine(
    (v) =>
      !["diğer", "diger", "other"].includes(
        v.part_name.toLocaleLowerCase("tr"),
      ) || v.other_part.trim().length >= 3,
    "Diğer parça için kısa bir açıklama girin.",
  );
export type RequestInput = z.infer<typeof requestSchema>;
export type Quote = {
  id: string;
  version: number;
  kind: "preliminary" | "final";
  amount: number;
  currency: "TRY";
  note: string;
  valid_until: string;
  created_at: string;
  sent_at: string | null;
  acceptance: string;
  accepted_at: string | null;
};
export type RequestOperations = {
  owner: "customer" | "third_party" | "unknown";
  shipping_authorized: boolean;
  consent_evidence: string;
  consent_date: string;
  terms_snapshot: RequestTerms | null;
  shipping_instructions: string;
  inbound_carrier: string;
  inbound_tracking: string;
  received_date: string;
  condition: string;
  damage: string;
  inspection: string;
  return_required: "unknown" | "yes" | "no";
  return_carrier: string;
  return_tracking: string;
  returned_date: string;
  next_follow_up: string;
  internal_note: string;
};
export type WorkRequest = {
  id: string;
  reference: string;
  kind: RequestKind;
  status: string;
  revision: number;
  created_at: string;
  updated_at: string;
  customer_id: string | null;
  input: RequestInput;
  snapshot: {
    brand: string;
    model: string;
    category: string;
    generation: string;
  };
  technical_review: boolean;
  operations: RequestOperations;
  quotes: Quote[];
  consents: { key: TermsKey; version: number; text: string }[];
};
export type RequestEvent = {
  id: string;
  request_id: string;
  created_at: string;
  actor: string;
  type: string;
  from_status: string;
  to_status: string;
  note: string;
  detail: unknown;
};
export type RequestFile = {
  id: string;
  request_id: string;
  kind: "customer" | "received";
  path: string;
  name: string;
  mime: string;
  size: number;
  url?: string;
};
export function validateRequestSelection(input: RequestInput, c: Catalog) {
  const model = c.models.find(
    (m) =>
      m.id === input.model_id &&
      m.brand_id === input.brand_id &&
      m.published !== false,
  );
  const year = c.model_years.find(
    (y) => y.model_id === input.model_id && y.year === input.year,
  );
  if (!model || !year)
    throw Error("Marka, model ve üretim yılı seçimini kontrol edin.");
  if (input.generation_id && input.generation_id !== year.generation_id)
    throw Error("Nesil seçilen üretim yılıyla eşleşmiyor.");
  if (
    input.category_id &&
    !c.categories.some((v) => v.id === input.category_id)
  )
    throw Error("Kategori bulunamadı.");
  if (
    input.product_id &&
    !c.products.some((v) => v.id === input.product_id && v.published)
  )
    throw Error("İlgili ürün bulunamadı.");
  const source = new URL(input.source_path, "https://kuzmin.local");
  if (
    source.origin !== "https://kuzmin.local" ||
    !input.source_path.startsWith("/") ||
    input.source_path.startsWith("//")
  )
    throw Error("Kaynak sayfa geçersiz.");
  input.source_path = source.pathname + source.search;
  return {
    brand: c.brands.find((b) => b.id === model.brand_id)!.name,
    model: model.name,
    category:
      c.categories.find((v) => v.id === input.category_id)?.name.tr || "",
    generation:
      c.generations.find((g) => g.id === year.generation_id)?.name || "",
  };
}
export function newWorkRequest(
  input: RequestInput,
  c: Catalog,
  terms: RequestTerms,
  customerId: string | null,
  id = crypto.randomUUID(),
  now = new Date().toISOString(),
): WorkRequest {
  const snapshot = validateRequestSelection(input, c);
  const consents = input.accepted_terms.map((key) => {
    const doc = terms.documents[key];
    if (
      terms.version !== input.terms_version ||
      !doc.approved ||
      !doc.text.trim()
    )
      throw Error("Koşullar güncellendi. Sayfayı yenileyip yeniden inceleyin.");
    return { key, version: terms.version, text: doc.text };
  });
  return {
    id,
    reference: `KZ-${input.kind === "custom" ? "OZ" : "UT"}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
    kind: input.kind,
    status: "new",
    revision: 1,
    created_at: now,
    updated_at: now,
    customer_id: customerId,
    input,
    snapshot,
    technical_review:
      input.kind === "custom" &&
      ["unavailable", "discuss"].includes(input.original),
    operations: {
      owner: "unknown",
      shipping_authorized: false,
      consent_evidence: "",
      consent_date: "",
      terms_snapshot: null,
      shipping_instructions: "",
      inbound_carrier: "",
      inbound_tracking: "",
      received_date: "",
      condition: "",
      damage: "",
      inspection: "",
      return_required: "unknown",
      return_carrier: "",
      return_tracking: "",
      returned_date: "",
      next_follow_up: "",
      internal_note: "",
    },
    quotes: [],
    consents,
  };
}
const date = z
  .string()
  .max(10)
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Tarih biçimi geçersiz.");
export const operationsSchema = z.object({
  owner: z.enum(["customer", "third_party", "unknown"]),
  shipping_authorized: z.boolean(),
  consent_evidence: notes,
  consent_date: date,
  shipping_instructions: notes,
  inbound_carrier: line,
  inbound_tracking: line,
  received_date: date,
  condition: notes,
  damage: notes,
  inspection: notes,
  return_required: z.enum(["unknown", "yes", "no"]),
  return_carrier: line,
  return_tracking: line,
  returned_date: date,
  next_follow_up: date,
  internal_note: notes,
});
const termSchema = z
  .object({ text: z.string().trim().max(16000), approved: z.boolean() })
  .refine(
    (v) => !v.approved || v.text.length > 10,
    "Onaylamadan önce koşul metnini girin.",
  );
export const termsSchema = z.object({
  version: z.number().int().nonnegative(),
  documents: z.object({
    ownership: termSchema,
    damage: termSchema,
    returns: termSchema,
    mould: termSchema,
  }),
});
export function changeRequest(
  record: WorkRequest,
  action: unknown,
  terms: RequestTerms,
  actor: string,
  now = new Date().toISOString(),
) {
  const a = z
    .object({
      type: z.enum([
        "status",
        "operations",
        "quote",
        "quote_sent",
        "quote_accepted",
      ]),
      status: line.optional(),
      note: notes.default(""),
      data: z.unknown().optional(),
      quote_id: line.optional(),
    })
    .parse(action);
  const next = structuredClone(record);
  let detail: unknown = null;
  if (a.type === "status") {
    if (!a.status || !Object.hasOwn(requestStages[record.kind], a.status))
      throw Error("Geçersiz talep aşaması.");
    if (
      record.kind === "custom" &&
      [
        "awaiting_part",
        "part_in_transit",
        "part_received",
        "physical_review",
      ].includes(a.status) &&
      !next.operations.shipping_authorized
    )
      throw Error(
        "Referans parça akışından önce gönderim koşullarını ve müşteri onayını kaydedin.",
      );
    if (!a.note.trim())
      throw Error("Durum değişikliği için kısa bir açıklama girin.");
    next.status = a.status;
  } else if (a.type === "operations") {
    const data = operationsSchema.parse(a.data);
    if (data.shipping_authorized) {
      if (
        !data.consent_evidence.trim() ||
        !data.consent_date ||
        !data.shipping_instructions.trim()
      )
        throw Error(
          "Gönderim onayı için müşteri onay kaydını, tarihini ve gönderim koşullarını girin.",
        );
      if (
        !next.operations.shipping_authorized &&
        !Object.values(terms.documents).every(
          (d) => d.approved && d.text.trim(),
        )
      )
        throw Error(
          "Gönderimden önce dört koşul dokümanını hazırlayıp onaylayın.",
        );
    }
    next.operations = {
      ...data,
      terms_snapshot: data.shipping_authorized
        ? next.operations.terms_snapshot || structuredClone(terms)
        : null,
    };
    detail = {
      changes: Object.keys(data).filter(
        (k) =>
          JSON.stringify(data[k as keyof typeof data]) !==
          JSON.stringify(record.operations[k as keyof RequestOperations]),
      ),
      shipping_terms_version: next.operations.terms_snapshot?.version,
      before: structuredClone(record.operations),
      after: structuredClone(next.operations),
    };
  } else if (a.type === "quote") {
    if (record.kind !== "custom")
      throw Error("Teklif yalnızca özel üretim talepleri için hazırlanır.");
    const q = z
      .object({
        kind: z.enum(["preliminary", "final"]),
        amount: z.number().finite().min(0).max(1e8),
        note: notes,
        valid_until: date,
      })
      .parse(a.data);
    const quote = {
      ...q,
      id: crypto.randomUUID(),
      version: next.quotes.length + 1,
      currency: "TRY" as const,
      created_at: now,
      sent_at: null,
      acceptance: "",
      accepted_at: null,
    };
    next.quotes.push(quote);
    detail = quote;
  } else {
    const q = next.quotes.find((q) => q.id === a.quote_id);
    if (!q) throw Error("Teklif bulunamadı.");
    if (a.type === "quote_sent") {
      if (q.sent_at) throw Error("Teklifin iletim kaydı zaten var.");
      if (!a.note.trim())
        throw Error("Teklifin ne zaman, hangi kanalla iletildiğini yazın.");
      q.sent_at = now;
    } else {
      if (!q.sent_at || !a.note.trim())
        throw Error(
          "Önce teklifin iletimini, sonra müşteri onayının kanıtını kaydedin.",
        );
      if (q.accepted_at) throw Error("Teklif onayı zaten kayıtlı.");
      q.acceptance = a.note;
      q.accepted_at = now;
    }
    detail = structuredClone(q);
  }
  next.revision++;
  next.updated_at = now;
  const event: RequestEvent = {
    id: crypto.randomUUID(),
    request_id: record.id,
    created_at: now,
    actor,
    type: a.type,
    from_status: record.status,
    to_status: next.status,
    note: a.note,
    detail,
  };
  return { next, event };
}
export function requestInsights(rows: WorkRequest[]) {
  const group = (key: (r: WorkRequest) => string) => {
    const map = new Map<
      string,
      { name: string; count: number; customers: Set<string> }
    >();
    for (const r of rows) {
      const name = key(r);
      const v = map.get(name) || {
        name,
        count: 0,
        customers: new Set<string>(),
      };
      v.count++;
      v.customers.add(
        r.input.email.toLowerCase() || r.input.phone.replace(/\D/g, ""),
      );
      map.set(name, v);
    }
    return [...map.values()]
      .map((v) => ({
        name: v.name,
        count: v.count,
        customers: v.customers.size,
      }))
      .sort((a, b) => b.count - a.count);
  };
  return {
    total: rows.length,
    custom: rows.filter((r) => r.kind === "custom").length,
    demand: rows.filter((r) => r.kind === "demand").length,
    technical: rows.filter((r) => r.technical_review).length,
    byModel: group((r) => `${r.snapshot.brand} ${r.snapshot.model}`),
    byPart: group((r) => r.input.part_name.toLocaleLowerCase("tr").trim()),
    byStatus: group(
      (r) => (requestStages[r.kind] as Record<string, string>)[r.status],
    ),
    quoteTotal: rows.reduce((s, r) => s + (r.quotes.at(-1)?.amount || 0), 0),
  };
}
export function requestLink(
  kind: RequestKind,
  context: Record<string, string | number | undefined> = {},
) {
  const q = new URLSearchParams({ type: kind });
  for (const [k, v] of Object.entries(context))
    if (v !== undefined && v !== "") q.set(k, String(v));
  return "/parcani-urettir?" + q.toString() + "#talep-formu";
}
