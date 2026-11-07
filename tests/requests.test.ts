import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { seed } from "../src/lib/seed";
import {
  requestSchema,
  publicRequestSchema,
  newWorkRequest,
  blankTerms,
  changeRequest,
  requestInsights,
  requestPeriod,
  termsSchema,
  requestLink,
  type RequestTerms,
} from "../src/lib/requests";

function input(kind: "custom" | "demand" = "custom") {
  return requestSchema.parse({
    submission_key: crypto.randomUUID(),
    kind,
    brand_name: "YAMAHA",
    model_name: "MT-25",
    length_cm: 25.5,
    width_cm: 12.5,
    part_description: "Karbon özel panel isteği.",
    brand_id: "yamaha",
    model_id: "yamaha-mt-25",
    year: 2024,
    part_name: "Karbon özel panel",
    original: "unavailable",
    name: "Test Customer",
    email: "requests@example.test",
    permission: true,
    source_path: "/motosikletler/yamaha/mt-25/2024?category=body",
  });
}
function approved(): RequestTerms {
  const t = structuredClone(blankTerms);
  t.version = 1;
  for (const d of Object.values(t.documents)) {
    d.text = "Yalnızca test için hazırlanmış örnek koşul metni.";
    d.approved = true;
  }
  return t;
}
test("CRM and analytics derive the same saved requests, free motorcycles and production choices without contact details", () => {
  const now = Date.now();
  const a = newWorkRequest(
    { ...input(), material: "forged", manufacturing_method: "lamination" },
    seed,
    blankTerms,
    null,
  );
  const b = newWorkRequest(
    {
      ...input("demand"),
      brand_name: "Honda",
      model_name: "CBR650R",
      material: "twill",
      manufacturing_method: "infusion",
    },
    seed,
    blankTerms,
    null,
  );
  const old = structuredClone(a);
  old.id = crypto.randomUUID();
  old.created_at = new Date(now - 40 * 86400000).toISOString();
  const future = structuredClone(a);
  future.created_at = new Date(now + 86400000).toISOString();
  const report = requestInsights(
    requestPeriod([a, b, old, future], 30, now + 100),
  );
  assert.equal(report.total, 2);
  assert.equal(report.new, 2);
  assert.equal(report.byBrand.find((v) => v.name === "Honda")?.count, 1);
  assert.equal(
    report.byMaterial.find((v) => v.name === "Twill Carbon")?.count,
    1,
  );
  assert.equal(
    report.byMethod.find((v) => v.name.startsWith("İnfüzyon"))?.count,
    1,
  );
  assert.equal(report.bySource[0].name.includes("?"), false);
  assert.equal(JSON.stringify(report).includes(a.input.email), false);
  assert.equal(requestPeriod([old], 0, now).length, 1);
});
test("public enquiries require a carbon style, production method, phone and email while legacy CRM records remain readable", () => {
  const valid = {
    ...input(),
    material: "twill",
    manufacturing_method: "infusion",
    phone: "+905550001122",
  };
  assert.equal(publicRequestSchema.parse(valid).material, "twill");
  assert.equal(
    publicRequestSchema.parse({
      ...valid,
      material: "forged",
      manufacturing_method: "lamination",
    }).manufacturing_method,
    "lamination",
  );
  for (const missing of [
    { material: "undecided" },
    { manufacturing_method: "unspecified" },
    { email: "" },
    { phone: "" },
  ]) {
    assert.equal(
      publicRequestSchema.safeParse({ ...valid, ...missing }).success,
      false,
    );
  }
  assert.equal(
    requestSchema.parse(input()).manufacturing_method,
    "unspecified",
  );
});
test("guest request validation, exact motorcycle/year context and technical-review marking", () => {
  const r = newWorkRequest(input(), seed, blankTerms, null);
  assert(r.technical_review);
  assert.equal(r.snapshot.model, "MT-25");
  assert.equal(r.customer_id, null);
  assert(r.reference.startsWith("KZ-OZ-"));
  assert.equal(
    newWorkRequest(
      input("demand"),
      seed,
      blankTerms,
      null,
    ).reference.startsWith("KZ-UT-"),
    true,
  );
  assert.throws(() =>
    requestSchema.parse({ ...input(), email: "", phone: "" }),
  );
  assert.throws(() =>
    requestSchema.parse({ ...input(), contact: "phone", phone: "" }),
  );
  assert.throws(() => requestSchema.parse({ ...input(), permission: false }));
  assert.throws(() => requestSchema.parse({ ...input(), website: "bot" }));
  for (const bad of [
    { brand_name: "" },
    { model_name: "" },
    { year: 0 },
    { length_cm: 0 },
    { width_cm: 0 },
    { source_path: "https://example.com/" },
  ] as const)
    assert.throws(() =>
      newWorkRequest({ ...input(), ...bad }, seed, blankTerms, null),
    );
  assert.equal(
    requestLink("demand", { model: "yamaha-mt-25", year: 2024 }).includes(
      "model=yamaha-mt-25",
    ),
    true,
  );
});
test("customer-entered brands/models/years and required dimensions do not depend on catalog inventory", () => {
  const original = structuredClone(seed);
  const free = {
    ...input(),
    brand_name: "Honda",
    model_name: "CBR650R",
    year: 2018,
  };
  const record = newWorkRequest(free, seed, blankTerms, null);
  assert.equal(record.snapshot.brand, "Honda");
  assert.equal(record.snapshot.model, "CBR650R");
  assert.equal(record.input.brand_id, "");
  assert.equal(record.input.model_id, "");
  assert.equal(record.input.generation_id, "");
  assert.equal(record.input.length_cm, 25.5);
  assert.equal(record.input.width_cm, 12.5);
  const empty = {
    ...seed,
    brands: [],
    models: [],
    model_years: [],
    generations: [],
  };
  assert.equal(
    newWorkRequest({ ...free }, empty, blankTerms, null).snapshot.brand,
    "Honda",
  );
  assert.throws(() =>
    requestSchema.parse({ ...input(), length_cm: undefined }),
  );
  assert.throws(() => requestSchema.parse({ ...input(), width_cm: undefined }));
  assert.deepEqual(seed, original);
});
test("CRM stages move forwards/backwards with history, shipping consent is explicit, quotes and terms retain evidence", () => {
  const r = newWorkRequest(input(), seed, blankTerms, null),
    terms = approved();
  assert.throws(
    () =>
      changeRequest(
        r,
        { type: "status", status: "awaiting_part", note: "Ship" },
        terms,
        "admin",
      ),
    /gönderim/,
  );
  assert.throws(() =>
    changeRequest(
      r,
      { type: "status", status: "invented", note: "test" },
      terms,
      "admin",
    ),
  );
  const ops = {
    ...r.operations,
    shipping_authorized: true,
    consent_evidence: "Test müşteri onayı alındı",
    consent_date: "2026-11-06",
    shipping_instructions: "Test gönderim koşulları",
  };
  assert.throws(
    () =>
      changeRequest(r, { type: "operations", data: ops }, blankTerms, "admin"),
    /dört koşul/,
  );
  let next = changeRequest(
    r,
    { type: "operations", data: ops },
    terms,
    "admin",
  ).next;
  assert.equal(next.operations.terms_snapshot?.version, 1);
  const moved = changeRequest(
    next,
    { type: "status", status: "awaiting_part", note: "Test onay kaydı" },
    terms,
    "admin",
  );
  assert.equal(moved.event.from_status, "new");
  assert.equal(moved.event.to_status, "awaiting_part");
  next = changeRequest(
    moved.next,
    { type: "status", status: "review", note: "İncelemeye geri dönüldü" },
    terms,
    "admin",
  ).next;
  next = changeRequest(
    next,
    {
      type: "quote",
      data: {
        kind: "preliminary",
        amount: 12500,
        note: "Sadece test teklifi",
        valid_until: "2026-12-01",
      },
    },
    terms,
    "admin",
  ).next;
  const quote = next.quotes[0];
  assert.throws(
    () =>
      changeRequest(
        next,
        { type: "quote_accepted", quote_id: quote.id, note: "Test" },
        terms,
        "admin",
      ),
    /Önce/,
  );
  next = changeRequest(
    next,
    {
      type: "quote_sent",
      quote_id: quote.id,
      note: "Telefonla iletildi; test kaydı",
    },
    terms,
    "admin",
  ).next;
  next = changeRequest(
    next,
    {
      type: "quote_accepted",
      quote_id: quote.id,
      note: "Test müşteri onay kaydı",
    },
    terms,
    "admin",
  ).next;
  const before = structuredClone(next.quotes[0]);
  next = changeRequest(
    next,
    {
      type: "quote",
      data: {
        kind: "final",
        amount: 13000,
        note: "Nihai test teklifi",
        valid_until: "",
      },
    },
    terms,
    "admin",
  ).next;
  assert.deepEqual(next.quotes[0], before);
  assert.equal(next.quotes[1].version, 2);
  const changed = structuredClone(terms);
  changed.version = 2;
  changed.documents.damage.text = "Yeni test koşulları";
  next = changeRequest(
    next,
    { type: "operations", data: ops },
    changed,
    "admin",
  ).next;
  assert.equal(next.operations.terms_snapshot?.version, 1);
  assert.equal(r.quotes.length, 0);
  assert.throws(() =>
    termsSchema.parse({
      ...blankTerms,
      documents: {
        ...blankTerms.documents,
        damage: { text: "", approved: true },
      },
    }),
  );
  const insights = requestInsights([r, next]);
  assert.equal(insights.custom, 2);
  assert.equal(insights.byModel[0].customers, 1);
  assert.equal(insights.quoteTotal, 13000);
});
test("PostgreSQL enquiries are private, service-only writes are idempotent and revision/history/terms are atomic", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated;`,
    );
    for (const file of [
      "001_store.sql",
      "007_model_visibility.sql",
      "008_work_requests.sql",
      "009_simple_work_requests.sql",
      "010_site_video.sql",
    ])
      await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
    await db.exec(readFileSync("supabase/seed.sql", "utf8"));
    const record = newWorkRequest(input(), seed, blankTerms, null),
      params = [
        JSON.stringify(record),
        JSON.stringify(
          Array.from({ length: 3 }, (_, i) => ({
            id: crypto.randomUUID(),
            request_id: record.id,
            kind: "customer",
            path: record.id + "/test-" + i + ".png",
            name: "test.png",
            mime: "image/png",
            size: 80,
          })),
        ),
        "source-a",
        record.input.submission_key,
        "digest-a",
      ];
    await db.exec("set role anon");
    await assert.rejects(() => db.query("select * from public.work_requests"));
    await assert.rejects(() =>
      db.query(
        "select public.submit_work_request($1::jsonb,$2::jsonb,$3,$4::uuid,$5)",
        params,
      ),
    );
    await db.exec("reset role;set role service_role");
    const submit = () =>
      db.query<{ value: { reference: string } }>(
        "select public.submit_work_request($1::jsonb,$2::jsonb,$3,$4::uuid,$5) value",
        params,
      );
    assert.equal((await submit()).rows[0].value.reference, record.reference);
    await submit();
    assert.equal(
      (await db.query("select * from public.work_requests")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.work_request_events")).rows.length,
      1,
    );
    await assert.rejects(
      () =>
        db.query(
          "select public.submit_work_request($1::jsonb,$2::jsonb,$3,$4::uuid,$5)",
          [...params.slice(0, 4), "different-digest"],
        ),
      /SUBMISSION_CONFLICT/,
    );
    const { next, event } = changeRequest(
      record,
      { type: "status", status: "review", note: "Test değerlendirme" },
      blankTerms,
      "admin",
    );
    await db.query(
      "select public.update_work_request($1,$2::jsonb,$3::jsonb)",
      [1, JSON.stringify(next), JSON.stringify(event)],
    );
    await assert.rejects(
      () =>
        db.query("select public.update_work_request($1,$2::jsonb,$3::jsonb)", [
          1,
          JSON.stringify(next),
          JSON.stringify(event),
        ]),
      /REQUEST_CONFLICT/,
    );
    assert.equal(
      (await db.query("select * from public.work_request_events")).rows.length,
      2,
    );
    await db.query("select public.save_work_terms($1,$2::jsonb)", [
      0,
      JSON.stringify(approved().documents),
    ]);
    await assert.rejects(
      () => db.query("select public.save_work_terms($1,$2::jsonb)", [0, "{}"]),
      /REQUEST_CONFLICT/,
    );
    await db.exec(
      "reset role;insert into auth.users values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');insert into public.admin_users values('00000000-0000-0000-0000-000000000001','admin'),('00000000-0000-0000-0000-000000000002','editor');set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';",
    );
    assert.equal(
      (await db.query("select * from public.work_requests")).rows.length,
      0,
    );
    await db.exec(
      "set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'",
    );
    assert.equal(
      (await db.query("select * from public.work_requests")).rows.length,
      1,
    );
    await assert.rejects(() =>
      db.query("update public.work_requests set revision=99"),
    );
    await db.exec("reset role;set role service_role");
    const outside = newWorkRequest(
      {
        ...input(),
        submission_key: crypto.randomUUID(),
        email: "outside@example.test",
        brand_name: "Honda",
        model_name: "CBR650R",
        year: 2018,
      },
      seed,
      blankTerms,
      null,
    );
    const outsidePhotos = Array.from({ length: 3 }, (_, i) => ({
      id: crypto.randomUUID(),
      request_id: outside.id,
      kind: "customer",
      path: outside.id + "/outside-" + i + ".png",
      name: "outside.png",
      mime: "image/png",
      size: 80,
    }));
    const submitOutside = (r = outside, photos = outsidePhotos) =>
      db.query(
        "select public.submit_work_request($1::jsonb,$2::jsonb,$3,$4::uuid,$5)",
        [
          JSON.stringify(r),
          JSON.stringify(photos),
          "outside-source",
          r.input.submission_key,
          "outside-digest",
        ],
      );
    await assert.rejects(
      () => submitOutside(outside, outsidePhotos.slice(0, 2)),
      /INVALID_FILES/,
    );
    await assert.rejects(
      () =>
        submitOutside({
          ...outside,
          input: { ...outside.input, length_cm: 0 },
        }),
      /INVALID_REQUEST/,
    );
    await submitOutside();
    const stored = (
      await db.query<{
        brand_id: string | null;
        model_id: string | null;
        brand_name: string;
        model_name: string;
        length_cm: string;
        width_cm: string;
      }>(
        "select brand_id,model_id,brand_name,model_name,length_cm,width_cm from public.work_requests where id=$1",
        [outside.id],
      )
    ).rows[0];
    assert.equal(stored.brand_id, null);
    assert.equal(stored.model_id, null);
    assert.equal(stored.brand_name, "Honda");
    assert.equal(stored.model_name, "CBR650R");
    assert.equal(Number(stored.length_cm), 25.5);
    assert.equal(Number(stored.width_cm), 12.5);
  } finally {
    await db.close();
  }
});
