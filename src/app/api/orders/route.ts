import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { orderSchema } from "@/lib/validation";
import { getCatalog } from "@/lib/catalog";
import { quote } from "@/lib/commerce";
import { isLive, localDB, insertLocal } from "@/lib/database";
import { sameOrigin, rateLimit } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!rateLimit("orders:" + req.headers.get("x-forwarded-for"), 5))
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  try {
    const input = orderSchema.parse(await req.json());
    if (isLive) {
      const s = await supabase();
      const { data, error } = await s.rpc("create_order_request", { input });
      if (error) throw new Error(error.message);
      return NextResponse.json(data, { status: 201 });
    }
    const db = localDB();
    db.exec("BEGIN IMMEDIATE");
    try {
      const q = quote(await getCatalog(), input.lines),
        id = randomUUID(),
        reference = `KZ-${randomUUID().slice(0, 8).toUpperCase()}`;
      insertLocal("orders", {
        id,
        reference,
        customer_name: input.customer_name,
        email: input.email,
        phone: input.phone,
        address: input.address,
        note: input.note,
        status: "demo_request",
        total: q.total,
        currency: "TRY",
        demo: true,
        created_at: new Date().toISOString(),
      });
      for (const line of q.items)
        insertLocal("order_items", {
          id: randomUUID(),
          order_id: id,
          product_id: line.product.id,
          variant_id: line.variant.id,
          title: line.product.title[input.locale],
          sku: line.variant.sku,
          quantity: line.quantity,
          unit_price: line.unit_price,
        });
      db.exec("COMMIT");
      return NextResponse.json(
        { reference, demo: true, total: q.total },
        { status: 201 },
      );
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  } catch (e) {
    const known = [
      "OUT_OF_STOCK",
      "INVALID_VARIANT",
      "EMPTY_CART",
      "INVALID_QUANTITY",
    ];
    return NextResponse.json(
      {
        error:
          e instanceof Error && known.includes(e.message)
            ? e.message
            : "ORDER_FAILED",
      },
      { status: 400 },
    );
  }
}
