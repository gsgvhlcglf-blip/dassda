import { NextResponse } from "next/server";
import { z } from "zod";
import { getRole, sameOrigin } from "@/lib/auth";
import { repository } from "@/server/persistence";
import {
  localWorkPhoto,
  boundedForm,
  parseWorkPhotos,
  storeWorkPhotos,
  discardUnlinkedWorkPhotos,
  attachWorkPhotos,
  findWorkRequest,
  workFiles,
  workHistory,
} from "@/lib/request-store";
import type { RequestFile, RequestEvent } from "@/lib/requests";
export const runtime = "nodejs";
export async function GET(req: Request) {
  if ((await getRole()) !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { file, bytes } = await localWorkPhoto(
      z.uuid().parse(new URL(req.url).searchParams.get("id")),
    );
    return new Response(bytes, {
      headers: {
        "Content-Type": file.mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Fotoğraf bulunamadı." },
      { status: 404 },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req) || (await getRole()) !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let files: RequestFile[] = [];
  let committed = false;
  try {
    const form = await boundedForm(req),
      id = z.uuid().parse(form.get("id")),
      record = await findWorkRequest(id),
      photos = await parseWorkPhotos(
        form.getAll("photos").filter((f): f is File => f instanceof File),
        8,
      );
    if (!photos.length) throw Error("Fotoğraf seçin.");
    if ((await workFiles(id)).length + photos.length > 24)
      throw Error("Talepte en fazla 24 fotoğraf tutulabilir.");
    files = await storeWorkPhotos(id, photos, "received");
    const actor = await (await repository("identity")).getStaffActor();
    const now = new Date().toISOString(),
      next = { ...record, revision: record.revision + 1, updated_at: now };
    const event: RequestEvent = {
      id: crypto.randomUUID(),
      request_id: id,
      created_at: now,
      actor,
      type: "files",
      from_status: record.status,
      to_status: record.status,
      note: `${files.length} teslim alma fotoğrafı eklendi.`,
      detail: { file_ids: files.map((f) => f.id) },
    };
    await attachWorkPhotos(files, record.revision, next, event);
    committed = true;
    return NextResponse.json({
      record: next,
      files: await workFiles(id),
      history: await workHistory(id),
    });
  } catch (e) {
    if (!committed) await discardUnlinkedWorkPhotos(files);
    const message = e instanceof Error ? e.message : "Fotoğraf yüklenemedi.";
    return NextResponse.json(
      {
        error:
          message === "REQUEST_CONFLICT"
            ? "Talep başka bir sekmede değişti. Güncel kaydı açıp fotoğrafları yeniden yükleyin."
            : committed
              ? "Fotoğraflar kaydedildi. Görüntülemek için talep kaydını yenileyin."
              : message,
      },
      { status: message === "REQUEST_CONFLICT" ? 409 : committed ? 503 : 400 },
    );
  }
}
