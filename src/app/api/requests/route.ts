import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { sameOrigin, rateLimit } from "@/lib/auth";
import { getCustomer } from "@/lib/customer";
import { getCatalog } from "@/lib/catalog";
import { isLive } from "@/lib/database";
import {
  publicRequestSchema,
  newWorkRequest,
  type RequestFile,
} from "@/lib/requests";
import {
  boundedForm,
  parseWorkPhotos,
  storeWorkPhotos,
  removeWorkPhotos,
  workTerms,
  submitWork,
  workFingerprint,
  workSource,
} from "@/lib/request-store";
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const source = workSource(req);
  if (!rateLimit("enquiries:" + source, 8))
    return NextResponse.json(
      { error: "Çok fazla başvuru yapıldı. Biraz sonra tekrar deneyin." },
      { status: 429 },
    );
  let saved: RequestFile[] = [];
  try {
    const form = await boundedForm(req),
      input = publicRequestSchema.parse(
        JSON.parse(String(form.get("payload") || "{}")),
      );
    const photos = await parseWorkPhotos(
      form.getAll("photos").filter((f): f is File => f instanceof File),
      8,
      3,
    );
    const [catalog, terms, customer] = await Promise.all([
      getCatalog(),
      workTerms(),
      getCustomer(),
    ]);
    const record = newWorkRequest(input, catalog, terms, customer?.id || null);
    saved = await storeWorkPhotos(record.id, photos, "customer");
    const result = await submitWork(
      record,
      saved,
      source,
      workFingerprint(input, photos),
    );
    if (result.id !== record.id) await removeWorkPhotos(saved);
    return NextResponse.json(
      { reference: result.reference, demo: !isLive },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    await removeWorkPhotos(saved);
    const message =
      e instanceof ZodError
        ? e.issues[0]?.message
        : e instanceof Error
          ? e.message
          : "Talep kaydedilemedi.";
    const rate = message?.includes("RATE_LIMITED"),
      conflict = message?.includes("SUBMISSION_CONFLICT");
    return NextResponse.json(
      {
        error: rate
          ? "Bu iletişim bilgisiyle kısa sürede birden fazla başvuru yapıldı. Daha sonra yeniden deneyin."
          : conflict
            ? "Bu form daha önce farklı bilgilerle gönderilmiş. Sayfayı yenileyin."
            : message,
      },
      { status: rate ? 429 : conflict ? 409 : 400 },
    );
  }
}
