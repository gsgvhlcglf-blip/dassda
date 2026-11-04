import { paymentLedger } from "@/lib/payments/store";
import { NextResponse } from "next/server";
import { getRole, sameOrigin } from "@/lib/auth";
import { isLive, updateLocal } from "@/lib/database";
import { getRows } from "@/lib/catalog";
import { schemas } from "@/lib/validation";
import { supabase } from "@/lib/supabase";
import { getWorkspace, saveWorkspace } from "@/lib/site-version-store";
import { editCatalog } from "@/lib/site-version";
import type { Catalog, Row } from "@/lib/types";
export async function GET() {
  const role = await getRole();
  if (!role)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const workspace = await getWorkspace();
    return NextResponse.json(
      {
        ...workspace.snapshot.catalog,
        ...(role === "admin"
          ? {
              orders: await getRows("orders"),
              payment_attempts: await paymentLedger().catch(() => []),
              order_items: await getRows("order_items"),
            }
          : {}),
        _workspace: [
          {
            id: "site",
            revision: workspace.revision,
            published_id: workspace.published_id,
          },
        ],
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Veriler yüklenemedi.",
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
    const { table, action, record, expectedRevision, inventoryChanged } =
      await req.json();
    if (
      !Object.hasOwn(schemas, table) ||
      !["insert", "update", "delete"].includes(action)
    )
      throw Error("İşlem geçersiz.");
    if ((table === "orders" || action === "delete") && role !== "admin")
      return NextResponse.json(
        { error: "Yönetici yetkisi gerekli." },
        { status: 403 },
      );
    const schema = schemas[table as keyof typeof schemas],
      row =
        action === "delete"
          ? { id: String(record.id) }
          : (schema.parse(record) as Row);
    if (table === "orders") {
      const current = (await getRows("orders")).find((o) => o.id === row.id);
      if (
        current?.payment_provider &&
        ["confirmed", "shipped"].includes(String(row.status)) &&
        current.payment_status !== "paid"
      )
        throw Error(
          "Kartlı siparişte ödeme doğrulanmadan onay veya gönderim yapılamaz.",
        );
      if (action !== "update") throw Error("Sipariş yalnızca güncellenebilir.");
      if (isLive) {
        const { error } = await (
          await supabase()
        )
          .from("orders")
          .update({ status: row.status })
          .eq("id", row.id);
        if (error) throw error;
      } else updateLocal("orders", row);
      return NextResponse.json({ ok: true });
    }
    const workspace = await getWorkspace();
    if (expectedRevision != null && expectedRevision !== workspace.revision)
      throw Error("WORKSPACE_CONFLICT");
    let inventory:
      { table: "products" | "variants"; id: string; stock: number } | undefined;
    if (action === "update" && ["products", "variants"].includes(table)) {
      const old = (
        workspace.snapshot.catalog[table as keyof Catalog] as Row[]
      ).find((r) => r.id === row.id);
      if (inventoryChanged === true)
        inventory = { table, id: row.id, stock: Number(row.stock) };
      else if (old) row.stock = old.stock;
    }
    const catalog = editCatalog(workspace.snapshot.catalog, table, action, row);
    await saveWorkspace(
      workspace.revision,
      { catalog, design: workspace.snapshot.design },
      inventory,
    );
    return NextResponse.json({ ok: true, draft: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "İşlem tamamlanamadı.";
    return NextResponse.json(
      {
        error:
          message === "WORKSPACE_CONFLICT"
            ? "Başka bir sekmede değişiklik yapıldı. Güncel verileri yükleyip yeniden deneyin."
            : message,
      },
      { status: message === "WORKSPACE_CONFLICT" ? 409 : 400 },
    );
  }
}
