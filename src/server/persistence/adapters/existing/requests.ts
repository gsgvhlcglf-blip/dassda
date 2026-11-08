import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { isLive, localDB } from "@/lib/database";
import {
  blankTerms,
  requestInsights,
  requestPeriod,
  type RequestTerms,
  type WorkRequest,
  type RequestFile,
  type RequestEvent,
} from "@/lib/requests";

function privileged() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw Error("Talep hizmeti için sunucu yapılandırması eksik.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
function tables() {
  const db = localDB();
  db.exec(`CREATE TABLE IF NOT EXISTS work_requests(id TEXT PRIMARY KEY,reference TEXT UNIQUE NOT NULL,submission_key TEXT UNIQUE NOT NULL,fingerprint TEXT NOT NULL,source_hash TEXT NOT NULL,body TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS work_request_events(id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES work_requests(id),created_at TEXT NOT NULL,body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS work_request_files(id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES work_requests(id),body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS work_terms_versions(version INTEGER PRIMARY KEY,body TEXT NOT NULL);`);
  db.prepare("INSERT OR IGNORE INTO work_terms_versions VALUES(0,?)").run(
    JSON.stringify(blankTerms),
  );
  return db;
}
export async function workTerms(): Promise<RequestTerms> {
  if (!isLive) {
    const r = tables()
      .prepare(
        "SELECT body FROM work_terms_versions ORDER BY version DESC LIMIT 1",
      )
      .get()!;
    return JSON.parse(String(r.body));
  }
  const { data, error } = await privileged()
    .from("work_terms_versions")
    .select("body")
    .order("version", { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data.body;
}
export async function workReadiness() {
  const terms = await workTerms();
  if (!isLive) return terms;
  const db = privileged();
  const [schema, bucket] = await Promise.all([
    db
      .from("work_requests")
      .select("id,brand_name,model_name,length_cm,width_cm")
      .limit(0),
    db.storage.getBucket("work-requests"),
  ]);
  if (schema.error || bucket.error || !bucket.data || bucket.data.public)
    throw Error("REQUEST_SETUP_REQUIRED");
  return terms;
}
export async function saveWorkTerms(terms: RequestTerms) {
  if (isLive) {
    const { data, error } = await privileged().rpc("save_work_terms", {
      expected: terms.version,
      documents: terms.documents,
    });
    if (error) throw Error(error.message);
    return data as RequestTerms;
  }
  const db = tables();
  db.exec("BEGIN IMMEDIATE");
  try {
    const old = db
      .prepare("SELECT max(version) v FROM work_terms_versions")
      .get()!;
    if (Number(old.v) !== terms.version) throw Error("REQUEST_CONFLICT");
    const next = { ...terms, version: terms.version + 1 };
    db.prepare("INSERT INTO work_terms_versions VALUES(?,?)").run(
      next.version,
      JSON.stringify(next),
    );
    db.exec("COMMIT");
    return next;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export async function allWorkRequests(): Promise<WorkRequest[]> {
  if (!isLive)
    return tables()
      .prepare("SELECT body FROM work_requests ORDER BY created_at DESC")
      .all()
      .map((r) => JSON.parse(String(r.body)));
  const records: WorkRequest[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await privileged()
      .from("work_requests")
      .select("body")
      .order("created_at", { ascending: false })
      .range(offset, offset + 999);
    if (error) throw error;
    records.push(...data.map((r) => r.body));
    if (data.length < 1000) break;
  }
  return records;
}
export async function findWorkRequest(id: string): Promise<WorkRequest> {
  if (!isLive) {
    const row = tables()
      .prepare("SELECT body FROM work_requests WHERE id=?")
      .get(id);
    if (!row) throw Error("Talep bulunamadı.");
    return JSON.parse(String(row.body));
  }
  const { data, error } = await privileged()
    .from("work_requests")
    .select("body")
    .eq("id", id)
    .single();
  if (error || !data) throw Error("Talep bulunamadı.");
  return data.body;
}
export async function workInsights(days: number) {
  return requestInsights(requestPeriod(await allWorkRequests(), days));
}
export async function workHistory(id: string): Promise<RequestEvent[]> {
  if (!isLive)
    return tables()
      .prepare(
        "SELECT body FROM work_request_events WHERE request_id=? ORDER BY created_at DESC",
      )
      .all(id)
      .map((r) => JSON.parse(String(r.body)));
  const { data, error } = await privileged()
    .from("work_request_events")
    .select("*")
    .eq("request_id", id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function workFiles(id: string): Promise<RequestFile[]> {
  if (!isLive)
    return tables()
      .prepare("SELECT id,body FROM work_request_files WHERE request_id=?")
      .all(id)
      .map((r) => ({
        ...JSON.parse(String(r.body)),
        url: "/api/admin/requests/files?id=" + r.id,
      }));
  const db = privileged();
  const { data, error } = await db
    .from("work_request_files")
    .select("*")
    .eq("request_id", id);
  if (error) throw error;
  return Promise.all(
    data.map(async (f) => {
      const { data: link, error } = await db.storage
        .from("work-requests")
        .createSignedUrl(f.path, 300);
      if (error) throw error;
      return { ...f, url: link.signedUrl };
    }),
  );
}
export async function saveWorkMutation(
  expected: number,
  record: WorkRequest,
  event: RequestEvent,
) {
  if (isLive) {
    const { error } = await privileged().rpc("update_work_request", {
      expected,
      record,
      event,
    });
    if (error) throw Error(error.message);
    return;
  }
  const db = tables();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = db
      .prepare(
        "UPDATE work_requests SET body=?,revision=? WHERE id=? AND revision=?",
      )
      .run(JSON.stringify(record), record.revision, record.id, expected);
    if (!result.changes) throw Error("REQUEST_CONFLICT");
    db.prepare("INSERT INTO work_request_events VALUES(?,?,?,?)").run(
      event.id,
      record.id,
      event.created_at,
      JSON.stringify(event),
    );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export async function submitWork(
  record: WorkRequest,
  files: RequestFile[],
  source: string,
  fingerprint: string,
) {
  if (files.length < 3 || files.length > 8)
    throw Error("En az 3, en fazla 8 fotoğraf ekleyin.");
  if (isLive) {
    const { data, error } = await privileged().rpc("submit_work_request", {
      record,
      photos: files,
      source,
      submission: record.input.submission_key,
      digest: fingerprint,
    });
    if (error) {
      // An RPC response can be lost after commit. Recover the original receipt.
      const recovered = await privileged()
        .from("work_requests")
        .select("id,reference,fingerprint")
        .eq("submission_key", record.input.submission_key)
        .maybeSingle();
      if (recovered.data?.fingerprint === fingerprint)
        return { id: recovered.data.id, reference: recovered.data.reference };
      throw Error(error.message);
    }
    return data as { id: string; reference: string };
  }
  const db = tables();
  db.exec("BEGIN IMMEDIATE");
  try {
    const old = db
      .prepare(
        "SELECT id,reference,fingerprint FROM work_requests WHERE submission_key=?",
      )
      .get(record.input.submission_key);
    if (old) {
      if (old.fingerprint !== fingerprint) throw Error("SUBMISSION_CONFLICT");
      db.exec("COMMIT");
      return { id: String(old.id), reference: String(old.reference) };
    }
    const since = new Date(Date.now() - 600000).toISOString();
    const count = db
      .prepare(
        "SELECT count(*) n FROM work_requests WHERE source_hash=? AND created_at>?",
      )
      .get(source, since)!;
    const recent = db
      .prepare("SELECT body FROM work_requests WHERE created_at>?")
      .all(since)
      .map((r) => JSON.parse(String(r.body)) as WorkRequest);
    if (
      Number(count.n) >= 5 ||
      recent.filter(
        (r) =>
          (record.input.email &&
            r.input.email.toLowerCase() === record.input.email.toLowerCase()) ||
          (record.input.phone && r.input.phone === record.input.phone),
      ).length >= 3
    )
      throw Error("RATE_LIMITED");
    db.prepare("INSERT INTO work_requests VALUES(?,?,?,?,?,?,?,?)").run(
      record.id,
      record.reference,
      record.input.submission_key,
      fingerprint,
      source,
      JSON.stringify(record),
      record.revision,
      record.created_at,
    );
    const event: RequestEvent = {
      id: randomUUID(),
      request_id: record.id,
      created_at: record.created_at,
      actor: "customer",
      type: "created",
      from_status: "",
      to_status: "new",
      note: "Talep alındı",
      detail: { consents: record.consents, contact_permission: true },
    };
    db.prepare("INSERT INTO work_request_events VALUES(?,?,?,?)").run(
      event.id,
      record.id,
      event.created_at,
      JSON.stringify(event),
    );
    for (const f of files)
      db.prepare("INSERT INTO work_request_files VALUES(?,?,?)").run(
        f.id,
        record.id,
        JSON.stringify(f),
      );
    db.exec("COMMIT");
    return { id: record.id, reference: record.reference };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export type PreparedPhoto = {
  name: string;
  mime: string;
  extension: string;
  bytes: Buffer;
};
export async function parseWorkPhotos(
  files: File[],
  limit: number,
  minimum = 0,
) {
  if (files.length < minimum) throw Error(`En az ${minimum} fotoğraf ekleyin.`);
  if (files.length > limit) throw Error(`En fazla ${limit} fotoğraf yükleyin.`);
  let total = 0;
  const result: PreparedPhoto[] = [];
  for (const f of files) {
    total += f.size;
    if (f.size < 12 || f.size > 5242880 || total > 20971520)
      throw Error(
        "Fotoğraflar dosya başına 5 MB, toplam 20 MB sınırını aşamaz.",
      );
    const bytes = Buffer.from(await f.arrayBuffer());
    const ext =
      bytes[0] === 255 && bytes[1] === 216
        ? "jpg"
        : bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? "png"
          : bytes.subarray(0, 4).toString() === "RIFF" &&
              bytes.subarray(8, 12).toString() === "WEBP"
            ? "webp"
            : null;
    if (!ext)
      throw Error("Yalnızca JPEG, PNG ve WebP fotoğraflar kabul edilir.");
    result.push({
      name: f.name.slice(0, 120),
      mime: ext === "jpg" ? "image/jpeg" : `image/${ext}`,
      extension: ext,
      bytes,
    });
  }
  return result;
}
export async function storeWorkPhotos(
  id: string,
  photos: PreparedPhoto[],
  kind: RequestFile["kind"],
) {
  const saved: RequestFile[] = [];
  try {
    for (const p of photos) {
      const fileId = randomUUID(),
        file: RequestFile = {
          id: fileId,
          request_id: id,
          kind,
          path: `${id}/${fileId}.${p.extension}`,
          name: p.name,
          mime: p.mime,
          size: p.bytes.length,
        };
      if (isLive) {
        const { error } = await privileged()
          .storage.from("work-requests")
          .upload(file.path, p.bytes, { contentType: p.mime, upsert: false });
        if (error) throw error;
      } else {
        await mkdir(path.join(process.cwd(), ".data/request-files", id), {
          recursive: true,
        });
        await writeFile(
          path.join(process.cwd(), ".data/request-files", file.path),
          p.bytes,
        );
      }
      saved.push(file);
    }
    return saved;
  } catch (e) {
    await removeWorkPhotos(saved);
    throw e;
  }
}
export async function removeWorkPhotos(files: RequestFile[]) {
  if (!files.length) return;
  if (isLive) {
    const { error } = await privileged()
      .storage.from("work-requests")
      .remove(files.map((f) => f.path));
    if (error) throw error;
  } else
    for (const f of files)
      await unlink(
        path.join(process.cwd(), ".data/request-files", f.path),
      ).catch(() => {});
}
export async function discardUnlinkedWorkPhotos(files: RequestFile[]) {
  if (!files.length) return;
  try {
    let linked: Set<string>;
    if (isLive) {
      const { data, error } = await privileged()
        .from("work_request_files")
        .select("id")
        .in(
          "id",
          files.map((f) => f.id),
        );
      if (error) throw error;
      linked = new Set(data.map((f) => f.id));
    } else {
      const db = tables();
      linked = new Set(
        files
          .filter((f) =>
            db
              .prepare("SELECT id FROM work_request_files WHERE id=?")
              .get(f.id),
          )
          .map((f) => f.id),
      );
    }
    await removeWorkPhotos(files.filter((f) => !linked.has(f.id)));
  } catch {
    // An uncertain commit must never delete photographs already linked to a CRM record.
    console.warn("WORK_REQUEST_CLEANUP_DEFERRED");
  }
}
export async function attachWorkPhotos(
  files: RequestFile[],
  expected: number,
  record: WorkRequest,
  event: RequestEvent,
) {
  if (isLive) {
    const { error } = await privileged().rpc("attach_work_files", {
      expected,
      record,
      event,
      photos: files,
    });
    if (error) throw error;
  } else {
    const db = tables();
    db.exec("BEGIN IMMEDIATE");
    try {
      const updated = db
        .prepare(
          "UPDATE work_requests SET body=?,revision=? WHERE id=? AND revision=?",
        )
        .run(JSON.stringify(record), record.revision, record.id, expected);
      if (!updated.changes) throw Error("REQUEST_CONFLICT");
      if (
        Number(
          db
            .prepare(
              "SELECT count(*) n FROM work_request_files WHERE request_id=?",
            )
            .get(record.id)!.n,
        ) +
          files.length >
        24
      )
        throw Error("Fotoğraf sınırı aşıldı.");
      for (const f of files)
        db.prepare("INSERT INTO work_request_files VALUES(?,?,?)").run(
          f.id,
          f.request_id,
          JSON.stringify(f),
        );
      db.prepare("INSERT INTO work_request_events VALUES(?,?,?,?)").run(
        event.id,
        record.id,
        event.created_at,
        JSON.stringify(event),
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}
export async function readPrivateRequestPhoto(id: string) {
  if (isLive) throw Error("Fotoğrafları talep kaydından açın.");
  const row = tables()
    .prepare("SELECT body FROM work_request_files WHERE id=?")
    .get(id);
  if (!row) throw Error("Fotoğraf bulunamadı.");
  const f = JSON.parse(String(row.body)) as RequestFile;
  return {
    file: f,
    bytes: await readFile(
      path.join(process.cwd(), ".data/request-files", f.path),
    ),
  };
}
export async function boundedForm(req: Request, maxBytes = 24 * 1024 * 1024) {
  const reader = req.body?.getReader();
  if (!reader) throw Error("Form verisi eksik.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        await reader.cancel();
        throw Error("Form yükleme sınırı aşıldı.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new Response(Buffer.concat(chunks), {
    headers: { "Content-Type": req.headers.get("content-type") || "" },
  }).formData();
}
export function workFingerprint(input: unknown, photos: PreparedPhoto[]) {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .update(
      photos
        .map((p) => createHash("sha256").update(p.bytes).digest("hex"))
        .join(":"),
    )
    .digest("hex");
}
export function workSource(req: Request) {
  return createHash("sha256")
    .update(
      (req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown") +
        "|" +
        (process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.LOCAL_SESSION_SECRET ||
          "local"),
    )
    .digest("hex");
}
