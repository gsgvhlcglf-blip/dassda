import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getRole, sameOrigin, rateLimit } from "@/lib/auth";
import { repository } from "@/server/persistence";
import { dispatchOrderNotices } from "@/server/order-notifications";
import { invoiceLimit, validateInvoice } from "@/lib/invoices";
export const runtime = "nodejs";
const id = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
export async function GET(req: Request) {
  if ((await getRole()) !== "admin")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    const url = new URL(req.url),
      orderId = id.parse(url.searchParams.get("order")),
      invoiceId = url.searchParams.get("file");
    const store = await repository("invoices");
    if (!invoiceId)
      return NextResponse.json(
        { invoices: await store.listInvoices(orderId) },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    const { invoice, bytes } = await store.readInvoice(
      orderId,
      z.uuid().parse(invoiceId),
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice.pdf"; filename*=UTF-8''${encodeURIComponent(invoice.file_name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Fatura bulunamadı veya yüklenemedi." },
      { status: 404 },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req) || (await getRole()) !== "admin")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!rateLimit("invoice:" + req.headers.get("x-forwarded-for"), 20))
    return NextResponse.json(
      { error: "Biraz sonra tekrar deneyin." },
      { status: 429 },
    );
  try {
    const reader = req.body?.getReader();
    if (!reader) throw Error("PDF dosyası seçin.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > invoiceLimit + 65536) {
        await reader.cancel();
        throw Error("Fatura en fazla 4 MB olmalıdır.");
      }
      chunks.push(part.value);
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": req.headers.get("content-type") || "" },
    }).formData();
    if (
      [...form.keys()].some(
        (k) => !["order", "expected", "file"].includes(k),
      ) ||
      form.getAll("file").length !== 1
    )
      throw Error("Geçersiz fatura alanları.");
    const orderId = id.parse(form.get("order")),
      expected = z.coerce.number().int().min(0).parse(form.get("expected")),
      file = form.get("file");
    if (!(file instanceof File)) throw Error("PDF dosyası seçin.");
    const bytes = Buffer.from(await file.arrayBuffer());
    validateInvoice(bytes, file.name, file.type);
    const invoice = await (
      await repository("invoices")
    ).uploadInvoice(orderId, { bytes, fileName: file.name, expected });
    after(async () => {
      try {
        await dispatchOrderNotices();
      } catch {
        /* The committed invoice and notice remain queued. */
      }
    });
    return NextResponse.json(
      { invoice },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fatura yüklenemedi.";
    return NextResponse.json(
      {
        error:
          message === "INVOICE_CONFLICT"
            ? "Fatura başka sekmede değişti. Yenileyip tekrar deneyin."
            : message,
      },
      { status: message === "INVOICE_CONFLICT" ? 409 : 400 },
    );
  }
}
