import { NextResponse } from "next/server";
import { getRole, sameOrigin } from "@/lib/auth";
import { isLive, insertLocal, updateLocal, deleteLocal } from "@/lib/database";
import { getRows } from "@/lib/catalog";
import { schemas } from "@/lib/validation";
import { supabase } from "@/lib/supabase";
import type { Row, Table } from "@/lib/types";
export async function GET() {
  if (!(await getRole()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRole();
  const tables = (
    [...Object.keys(schemas), "brands", "order_items"] as Table[]
  ).filter((t) => role === "admin" || !["orders", "order_items"].includes(t));
  try {
    return NextResponse.json(
      Object.fromEntries(
        await Promise.all(tables.map(async (t) => [t, await getRows(t)])),
      ),
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Database error" },
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
    const { table, action, record } = await req.json();
    if (
      !Object.hasOwn(schemas, table) ||
      !["insert", "update", "delete"].includes(action)
    )
      throw new Error("Unknown operation");
    if ((table === "orders" || action === "delete") && role !== "admin")
      return NextResponse.json(
        { error: "Admin role required" },
        { status: 403 },
      );
    if (table === "orders" && action !== "update")
      throw new Error("Orders can only be updated");
    const schema = schemas[table as keyof typeof schemas];
    const r =
      action === "delete"
        ? { id: String(record.id) }
        : (schema.parse(record) as Row);
    if (
      action !== "delete" &&
      ["compatibility", "model_years"].includes(table) &&
      r.generation_id
    ) {
      const generations = await getRows("generations");
      const g = generations.find((g) => g.id === r.generation_id);
      if (!g || g.model_id !== r.model_id)
        throw new Error("Generation must belong to the selected model");
      if (
        table === "model_years" &&
        (Number(r.year) < Number(g.start_year) ||
          Number(r.year) > Number(g.end_year))
      )
        throw new Error("Year must fall within the generation range");
      if (
        table === "compatibility" &&
        (Number(r.year_from) < Number(g.start_year) ||
          Number(r.year_to) > Number(g.end_year))
      )
        throw new Error("Compatibility must fall within the generation range");
    }
    if (table === "generations" && action === "update") {
      const children = [
        ...(await getRows("model_years")),
        ...(await getRows("compatibility")),
      ];
      if (
        children.some(
          (c) =>
            c.generation_id === r.id &&
            (c.model_id !== r.model_id ||
              Number(c.year ?? c.year_from) < Number(r.start_year) ||
              Number(c.year ?? c.year_to) > Number(r.end_year)),
        )
      )
        throw new Error(
          "Existing years or fitments would fall outside this generation. Update them first.",
        );
    }
    if (isLive) {
      const db = await supabase();
      const { error } =
        action === "delete"
          ? await db.from(table).delete().eq("id", r.id)
          : action === "update"
            ? await db
                .from(table)
                .update(table === "orders" ? { status: r.status } : r)
                .eq("id", r.id)
            : await db.from(table).insert(r);
      if (error) throw error;
    } else if (action === "delete") deleteLocal(table, r.id);
    else if (action === "update") updateLocal(table, r);
    else insertLocal(table, r);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Database operation failed. Check unique values and related records.",
      },
      { status: 400 },
    );
  }
}
