import { NextResponse } from "next/server";
import { z } from "zod";
import { getRole, sameOrigin } from "@/lib/auth";
import {
  getWorkspace,
  saveWorkspace,
  publishWorkspace,
} from "@/lib/site-version-store";
export async function GET() {
  if (!(await getRole()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await getWorkspace(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Çalışma alanı yüklenemedi.",
      },
      { status: 503 },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const role = await getRole();
  if (!role)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = await req.json(),
      expected = z.number().int().positive().parse(input.expectedRevision);
    if (input.action === "publish" || input.action === "restore") {
      if (role !== "admin")
        return NextResponse.json(
          { error: "Yayınlama için yönetici yetkisi gerekli." },
          { status: 403 },
        );
      const id =
        input.action === "restore"
          ? z.uuid().parse(input.versionId)
          : undefined;
      await publishWorkspace(expected, id);
    } else if (input.action === "design") {
      const workspace = await getWorkspace();
      if (workspace.revision !== expected) throw Error("WORKSPACE_CONFLICT");
      await saveWorkspace(expected, {
        catalog: workspace.snapshot.catalog,
        design: input.design,
      });
    } else throw Error("İşlem geçersiz.");
    return NextResponse.json(await getWorkspace(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "İşlem tamamlanamadı.";
    return NextResponse.json(
      {
        error: message.includes("WORKSPACE_CONFLICT")
          ? "Başka bir sekmede değişiklik yapıldı. Paneli yenileyin."
          : message.includes("foreign key")
            ? "Siparişte kullanılan bir ürün veya varyant silinemez. Ürünün yayınını kapatın."
            : message,
      },
      { status: message.includes("WORKSPACE_CONFLICT") ? 409 : 400 },
    );
  }
}
