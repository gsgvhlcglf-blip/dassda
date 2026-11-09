import { NextResponse } from "next/server";
import { getRole, sameOrigin } from "@/lib/auth";
import { repository } from "@/server/persistence";
import { shipmentSchema } from "@/lib/order-management";
import { isLive } from "@/lib/database";
import { z } from "zod";

export async function GET() {
  if ((await getRole()) !== "admin")
    return NextResponse.json(
      { error: "Yönetici yetkisi gerekli." },
      { status: 403 },
    );
  try {
    return NextResponse.json(
      {
        orders: await (await repository("orders")).listOrders(),
        demo: !isLive,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Siparişler yüklenemedi.",
      },
      { status: 503 },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req) || (await getRole()) !== "admin")
    return NextResponse.json(
      { error: "Yönetici yetkisi gerekli." },
      { status: 403 },
    );
  try {
    const input = z
      .object({ id: z.string().min(1).max(120), shipment: shipmentSchema })
      .strict()
      .parse(await req.json());
    const order = await (
      await repository("orders")
    ).shareTracking(input.id, input.shipment);
    return NextResponse.json(
      { order },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kargo bilgisi kaydedilemedi.";
    return NextResponse.json(
      {
        error:
          message === "ORDER_CONFLICT"
            ? "Sipariş başka bir sekmede güncellendi. Yenileyip tekrar deneyin."
            : message,
      },
      { status: message === "ORDER_CONFLICT" ? 409 : 400 },
    );
  }
}
