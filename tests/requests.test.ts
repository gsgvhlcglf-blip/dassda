import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { seed } from "../src/lib/seed";
import {
  requestSchema,
  newWorkRequest,
  blankTerms,
  changeRequest,
  requestInsights,
  termsSchema,
  requestLink,
  type RequestTerms,
} from "../src/lib/requests";

function input(kind: "custom" | "demand" = "custom") {
  return requestSchema.parse({
    submission_key: crypto.randomUUID(),
    kind,
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
    { brand_id: "bmw" },
    { year: 2030 },
    { generation_id: "bmw-s1000rr-demo" },
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
    ])
      await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
    await db.exec(readFileSync("supabase/seed.sql", "utf8"));
    const record = newWorkRequest(input(), seed, blankTerms, null),
      params = [
        JSON.stringify(record),
        "[]",
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
  } finally {
    await db.close();
  }
});
