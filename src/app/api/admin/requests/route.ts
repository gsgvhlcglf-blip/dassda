import { NextResponse } from "next/server";
import { z } from "zod";
import { getRole, sameOrigin } from "@/lib/auth";
import { isDemo } from "@/lib/database";
import { repository } from "@/server/persistence";
import {
  allWorkRequests,
  workInsights,
  findWorkRequest,
  workHistory,
  workFiles,
  workTerms,
  saveWorkTerms,
  saveWorkMutation,
} from "@/lib/request-store";
import { changeRequest, termsSchema, requestInsights } from "@/lib/requests";
export async function GET(req: Request) {
  if ((await getRole()) !== "admin")
    return NextResponse.json(
      { error: "Yönetici girişi gerekli." },
      { status: 401 },
    );
  try {
    const params = new URL(req.url).searchParams;
    const id = params.get("id");
    if (id) {
      z.uuid().parse(id);
      return NextResponse.json(
        {
          record: await findWorkRequest(id),
          history: await workHistory(id),
          files: await workFiles(id),
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (params.get("view") === "insights") {
      const days = z.coerce
        .number()
        .int()
        .min(0)
        .max(90)
        .parse(params.get("days") || 0);
      return NextResponse.json(
        {
          insights: await workInsights(days),
          demo: isDemo,
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const records = await allWorkRequests();
    return NextResponse.json(
      {
        records,
        terms: await workTerms(),
        insights: requestInsights(records),
        demo: isDemo,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Talepler yüklenemedi." },
      { status: 503 },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if ((await getRole()) !== "admin")
    return NextResponse.json(
      { error: "Yönetici girişi gerekli." },
      { status: 401 },
    );
  try {
    const input = await req.json();
    if (input.type === "terms") {
      return NextResponse.json({
        terms: await saveWorkTerms(termsSchema.parse(input.terms)),
      });
    }
    const id = z.uuid().parse(input.id),
      expected = z.number().int().positive().parse(input.expectedRevision),
      record = await findWorkRequest(id);
    if (record.revision !== expected) throw Error("REQUEST_CONFLICT");
    const actor = await (await repository("identity")).getStaffActor();
    const { next, event } = changeRequest(
      record,
      input.action,
      await workTerms(),
      actor,
    );
    await saveWorkMutation(expected, next, event);
    return NextResponse.json({
      record: next,
      history: await workHistory(id),
      files: await workFiles(id),
    });
  } catch (e) {
    const message =
      e instanceof z.ZodError
        ? e.issues[0]?.message
        : e instanceof Error
          ? e.message
          : "İşlem tamamlanamadı.";
    return NextResponse.json(
      {
        error:
          message === "REQUEST_CONFLICT"
            ? "Başka bir sekmede değişiklik yapıldı. Güncel kaydı açıp yeniden deneyin."
            : message,
      },
      { status: message === "REQUEST_CONFLICT" ? 409 : 400 },
    );
  }
}
