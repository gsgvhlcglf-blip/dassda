import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { ensureEmailSchema } from "../src/server/persistence/adapters/existing/notification-schema";
import { PGlite } from "@electric-sql/pglite";
import {
  defaultEmailDesign,
  emailDesignSchema,
  emailExampleOrder,
  renderOrderEmail,
} from "../src/lib/email-design";
import {
  exampleInvoicePDF,
  validateInvoice,
  invoiceLimit,
} from "../src/lib/invoices";
import { deliverOrderEmail, type NoticeJob } from "../src/lib/order-emails";

test("owner templates retain mandatory prices/reference, escape HTML and support three distinct messages", () => {
  const order = emailExampleOrder(),
    settings = structuredClone(defaultEmailDesign);
  settings.templates.order_confirmed.subject = "Teşekkürler";
  settings.brand = '<img src=x onerror="alert(1)">';
  order.customer_name = "<script>private</script>";
  const receipt = renderOrderEmail("order_confirmed", order, settings);
  assert(receipt.subject.includes(order.reference));
  assert(receipt.text.includes("2 adet ×"));
  assert(receipt.text.includes("3.750"));
  assert(receipt.text.includes("Brüt toplam (KDV dahil)"));
  assert(receipt.html.includes("BİRİM FİYAT"));
  assert(receipt.html.includes("&lt;script&gt;private&lt;/script&gt;"));
  assert(!receipt.html.includes("<img src=x"));
  order.tracking_url = "javascript:alert(1)";
  assert(
    !renderOrderEmail("shipment_shared", order).html.includes("javascript:"),
  );
  const invoice = renderOrderEmail("invoice_ready", order, settings, {
    file_name: "invoice-123.pdf",
    version: 1,
  });
  assert(invoice.html.includes("invoice-123.pdf"));
  assert(invoice.text.includes(order.reference));
  assert(
    !emailDesignSchema.safeParse({ ...settings, senderEmail: "not-an-email" })
      .success,
  );
  assert(
    !emailDesignSchema.safeParse({
      ...settings,
      accent: "red; background:url(x)",
    }).success,
  );
});

test("private invoice validation limits size and file signatures; provider receives a PDF attachment and HTML", async () => {
  const bytes = exampleInvoicePDF();
  assert.equal(
    validateInvoice(bytes, "fatura.pdf", "application/pdf"),
    "fatura.pdf",
  );
  assert.throws(() => validateInvoice(bytes, "fatura.exe", "application/pdf"));
  assert.throws(() =>
    validateInvoice(
      new Uint8Array(invoiceLimit + 1),
      "fatura.pdf",
      "application/pdf",
    ),
  );
  assert.throws(() =>
    validateInvoice(
      new TextEncoder().encode("%PDF-1.4 missing footer"),
      "fatura.pdf",
      "application/pdf",
    ),
  );
  const order = { ...emailExampleOrder(), demo: false };
  const message = renderOrderEmail("invoice_ready", order, defaultEmailDesign, {
    file_name: "invoice.pdf",
    version: 1,
  });
  const job = {
    id: "invoice-fixture",
    kind: "invoice_ready",
    version: 1,
    order,
  } as NoticeJob;
  const bodies: any[] = [];
  const transport: typeof fetch = async (_input, options) => {
    bodies.push(JSON.parse(options!.body as string));
    return Response.json({ id: "TEST-PROVIDER-ID" });
  };
  const options = {
    mail: { ...message, from: "sales@example.test" },
    attachment: {
      filename: "invoice.pdf",
      content: Buffer.from(bytes).toString("base64"),
    },
  };
  await deliverOrderEmail(
    job,
    { key: "TEST-ONLY-NOT-A-CREDENTIAL", from: "sales@example.test" },
    transport,
    options,
  );
  await deliverOrderEmail(
    job,
    {
      key: "TEST-ONLY-NOT-A-CREDENTIAL",
      from: "changed@example.test",
      replyTo: "changed@example.test",
    },
    transport,
    options,
  );
  assert.deepEqual(bodies[0], bodies[1]);
  assert.equal(bodies[0].to[0], order.email);
  assert.equal(bodies[0].from, "sales@example.test");
  assert.equal(bodies[0].html, message.html);
  assert.deepEqual(
    Buffer.from(bodies[0].attachments[0].content, "base64"),
    Buffer.from(bytes),
  );
});

test("PostgreSQL invoices register atomically, deduplicate, retain private files and freeze retry payloads", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
      create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
      alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated;`);
    for (const file of [
      "001_store",
      "002_customer_membership",
      "006_payments",
      "013_product_commerce",
      "015_order_tracking",
      "016_daily_order_references",
      "017_guest_checkout",
      "019_order_notifications",
      "020_invoice_email_design",
      "021_smtp_delivery",
    ])
      await db.exec(readFileSync(`supabase/migrations/${file}.sql`, "utf8"));
    await db.exec(readFileSync("supabase/seed.sql", "utf8"));
    await db.exec(
      `insert into public.orders(id,reference,customer_name,email,phone,address,note,status,total,currency,demo,created_at,payment_status) values('invoice-order','#1011261','Test Customer','buyer@example.test','05000000000','Test address 10','','confirmed',100,'TRY',false,now(),'paid')`,
    );
    const fileId = "00000000-0000-0000-0000-000000000031",
      hash = "a".repeat(64);
    const register = async (id = fileId, expected = 0, sha = hash) =>
      (
        await db.query<{ result: { id: string; version: number } }>(
          "select public.register_order_invoice($1,'invoice-order',$2,'invoice.pdf',$3,100,$4) result",
          [id, expected, id + ".pdf", sha],
        )
      ).rows[0].result;
    await db.exec("set role anon");
    await assert.rejects(register(), /permission denied/);
    for (const table of [
      "order_invoices",
      "order_email_design",
      "order_notifications",
    ])
      await assert.rejects(
        db.query("select * from public." + table),
        /permission denied/,
      );
    await db.exec("set role service_role;begin");
    await register();
    await db.exec("rollback;reset role");
    assert.equal(
      (await db.query("select * from public.order_invoices")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.order_notifications")).rows.length,
      0,
    );
    await db.exec("set role service_role");
    const first = await register();
    assert.equal(first.version, 1);
    const duplicate = await register("00000000-0000-0000-0000-000000000032");
    assert.equal(duplicate.id, first.id);
    await assert.rejects(
      register("00000000-0000-0000-0000-000000000033", 0, "b".repeat(64)),
      /INVOICE_CONFLICT/,
    );
    const lease = "00000000-0000-0000-0000-000000000034";
    const job = (
      await db.query<{ result: { id: string } }>(
        "select public.claim_order_notice($1) result",
        [lease],
      )
    ).rows[0].result;
    const payload = {
      from: "sales@example.test",
      to: "buyer@example.test",
      subject: "Fatura · #1011261",
      text: "Frozen",
      html: "<p>Frozen</p>",
    };
    const freeze = async (body: typeof payload) =>
      (
        await db.query<{ result: typeof payload }>(
          "select public.freeze_order_notice($1,$2,$3::jsonb) result",
          [job.id, lease, JSON.stringify(body)],
        )
      ).rows[0].result;
    assert.equal((await freeze(payload)).text, "Frozen");
    assert.equal(
      (await freeze({ ...payload, text: "Changed" })).text,
      "Frozen",
    );
    await assert.rejects(
      freeze({ ...payload, to: "outsider@example.test" }),
      /NOTICE_LEASE_EXPIRED/,
    );
    const design = await db.query<{ result: { revision: number } }>(
      "select public.save_order_email_design(0,$1::jsonb) result",
      [JSON.stringify(defaultEmailDesign)],
    );
    assert.equal(design.rows[0].result.revision, 1);
    await assert.rejects(
      db.query("select public.save_order_email_design(0,$1::jsonb)", [
        JSON.stringify(defaultEmailDesign),
      ]),
      /EMAIL_DESIGN_CONFLICT/,
    );
    await register("00000000-0000-0000-0000-000000000035", 1, "b".repeat(64));
    await db.exec("reset role");
    assert.equal(
      (await db.query("select * from public.order_invoices")).rows.length,
      2,
    );
    assert.equal(
      (
        await db.query(
          "select * from public.order_notifications where kind='invoice_ready'",
        )
      ).rows.length,
      2,
    );
    assert.equal(
      (
        await db.query<{ public: boolean }>(
          "select public from storage.buckets where id='order-invoices'",
        )
      ).rows[0].public,
      false,
    );
    // A worker can die after SMTP accepted DATA. Its expired lease must not resend.
    await db.exec("set role service_role");
    const smtpLease = "00000000-0000-0000-0000-000000000036";
    const smtpJob = (
      await db.query<{ job: { id: string } }>(
        "select public.claim_order_notice($1) job",
        [smtpLease],
      )
    ).rows[0].job;
    await db.query("select public.freeze_order_notice($1,$2,$3::jsonb)", [
      smtpJob.id,
      smtpLease,
      JSON.stringify({ ...payload, provider: "smtp" }),
    ]);
    await db.exec("reset role");
    await db.query(
      "update public.order_notifications set lease_until=now()-interval '1 minute' where id=$1",
      [smtpJob.id],
    );
    await db.exec("set role service_role");
    assert.equal(
      (
        await db.query<{ job: unknown }>(
          "select public.claim_order_notice(gen_random_uuid()) job",
        )
      ).rows[0].job,
      null,
    );
    await assert.rejects(
      db.query("select public.retry_order_notices('invoice-order')"),
      /NOTICE_RETRY_UNAVAILABLE/,
    );
    await db.exec("reset role");
    const held = (
      await db.query<{ status: string; error: string }>(
        "select status,error from public.order_notifications where id=$1",
        [smtpJob.id],
      )
    ).rows[0];
    assert.equal(held.status, "review");
    assert.equal(held.error, "EMAIL_SMTP_RESULT_UNKNOWN");
  } finally {
    await db.close();
  }
});

test("SQLite upgrade preserves legacy notification history while adding private invoice support", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(
      "CREATE TABLE orders(id TEXT PRIMARY KEY,payment_status TEXT,fulfillment_version INTEGER,tracking_number TEXT,shipped_at TEXT,status TEXT,demo INTEGER); INSERT INTO orders VALUES('legacy','paid',0,'',NULL,'confirmed',0);",
    );
    db.exec(
      "CREATE TABLE order_notifications(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN('order_confirmed','shipment_shared')),version INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,lease_token TEXT,lease_until TEXT,first_attempt_at TEXT,next_attempt_at TEXT NOT NULL,sent_at TEXT,provider_id TEXT,error TEXT,created_at TEXT NOT NULL,UNIQUE(order_id,kind,version));",
    );
    db.prepare(
      "INSERT INTO order_notifications(id,order_id,kind,version,status,next_attempt_at,created_at,provider_id) VALUES('confirmation-legacy','legacy','order_confirmed',0,'sent',?,?,?)",
    ).run(
      new Date().toISOString(),
      new Date().toISOString(),
      "OLD-PROVIDER-ID",
    );
    ensureEmailSchema(db);
    const retained = db
      .prepare(
        "SELECT * FROM order_notifications WHERE id='confirmation-legacy'",
      )
      .get()!;
    assert.equal(retained.status, "sent");
    assert.equal(retained.provider_id, "OLD-PROVIDER-ID");
    assert.equal(retained.email_payload, null);
    db.prepare(
      "INSERT INTO order_invoices(id,order_id,version,file_name,storage_key,size,sha256,created_at) VALUES('test-invoice','legacy',1,'fixture.pdf','fixture.pdf',100,?,?)",
    ).run("a".repeat(64), new Date().toISOString());
    assert.equal(
      db
        .prepare(
          "SELECT count(*) n FROM order_notifications WHERE kind='invoice_ready'",
        )
        .get()!.n,
      1,
    );
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
    assert.equal(
      db
        .prepare("SELECT revision FROM order_email_design WHERE id='site'")
        .get()!.revision,
      0,
    );
  } finally {
    db.close();
  }
});
