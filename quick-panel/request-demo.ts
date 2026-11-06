import type { Catalog } from "../src/lib/types";
import {
  blankTerms,
  requestSchema,
  newWorkRequest,
  changeRequest,
  termsSchema,
  type WorkRequest,
  type RequestEvent,
  type RequestTerms,
} from "../src/lib/requests";
import type { CRMTransport } from "../src/components/request-dashboard";
const key = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1.crm-demo.v1";
type Demo = {
  records: WorkRequest[];
  events: RequestEvent[];
  terms: RequestTerms;
};
export function requestDemo(c: Catalog): CRMTransport {
  let data: Demo;
  try {
    data = JSON.parse(localStorage.getItem(key) || "null");
    if (!data?.records || !data.terms) throw Error();
  } catch {
    data = { records: [], events: [], terms: structuredClone(blankTerms) };
  }
  function save() {
    localStorage.setItem(key, JSON.stringify(data));
  }
  function add() {
    const model = c.models.find(
      (m) =>
        m.published !== false && c.model_years.some((y) => y.model_id === m.id),
    );
    const year = c.model_years.find((y) => y.model_id === model?.id);
    const kind = data.records.length % 2 ? "demand" : "custom";
    const input = requestSchema.parse({
      submission_key: crypto.randomUUID(),
      kind,
      brand_id: model?.brand_id || "",
      model_id: model?.id || "",
      brand_name:
        c.brands.find((b) => b.id === model?.brand_id)?.name || "Örnek marka",
      model_name: model?.name || "Örnek model",
      year: year?.year || 2024,
      length_cm: 25.5,
      width_cm: 12.5,
      material: kind === "custom" ? "forged" : "twill",
      manufacturing_method: kind === "custom" ? "lamination" : "infusion",
      part_description:
        kind === "custom"
          ? "Örnek özel karbon kaplama"
          : "Örnek yeni ürün talebi",
      part_name:
        kind === "custom"
          ? "Örnek özel karbon kaplama"
          : "Örnek yeni ürün talebi",
      original: kind === "custom" ? "unavailable" : "can_ship",
      name: "Örnek müşteri " + (data.records.length + 1),
      email: `ornek${data.records.length + 1}@example.test`,
      permission: true,
      source_path: "/parcani-urettir",
    });
    const record = newWorkRequest(input, c, data.terms, null);
    record.reference = "DEMO-" + record.reference;
    data.records.unshift(record);
    data.events.push({
      id: crypto.randomUUID(),
      request_id: record.id,
      created_at: record.created_at,
      actor: "customer",
      type: "created",
      from_status: "",
      to_status: "new",
      note: "Yalnızca panel denemesi için örnek kayıt.",
      detail: null,
    });
    save();
  }
  if (!data.records.length) {
    add();
    add();
  }
  const detail = (id: string) => {
    const record = data.records.find((r) => r.id === id);
    if (!record) throw Error("Örnek talep bulunamadı.");
    return {
      record: structuredClone(record),
      history: data.events
        .filter((e) => e.request_id === id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      files: [],
    };
  };
  return {
    load: async () => ({
      records: structuredClone(data.records),
      terms: structuredClone(data.terms),
      demo: true,
    }),
    detail: async (id) => detail(id),
    act: async (record, action) => {
      const current = data.records.find((r) => r.id === record.id)!;
      if (record.revision !== current.revision)
        throw Error("Kayıt değişti. Yeniden açın.");
      const { next, event } = changeRequest(
        current,
        action,
        data.terms,
        "local-admin",
      );
      data.records = data.records.map((r) => (r.id === next.id ? next : r));
      data.events.push(event);
      save();
      return detail(next.id);
    },
    terms: async (terms) => {
      const parsed = termsSchema.parse(terms);
      if (parsed.version !== data.terms.version)
        throw Error("Koşullar değişti. Yeniden açın.");
      data.terms = { ...parsed, version: parsed.version + 1 };
      save();
      return structuredClone(data.terms);
    },
    sample: async () => {
      add();
    },
  };
}
