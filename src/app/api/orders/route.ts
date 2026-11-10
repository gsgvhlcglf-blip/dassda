import { NextResponse } from "next/server";
import { orderSchema } from "@/lib/validation";
import { sameOrigin, rateLimit } from "@/lib/auth";
import { repository } from "@/server/persistence";
import { getGuest } from "@/server/guest-session";
export async function GET() {
  const guest = await getGuest();
  try {
    const orders = guest
      ? await (await repository("orders")).guestOrders(guest.guestKey)
      : [];
    return NextResponse.json(
      { orders },
      { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
    );
  } catch {
    return NextResponse.json({ error: "ORDERS_UNAVAILABLE" }, { status: 503 });
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!rateLimit("orders:" + req.headers.get("x-forwarded-for"), 5))
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  try {
    const input = orderSchema.parse(await req.json());
    const customer = (await getGuest(true))!;
    const result = await (
      await repository("orders")
    ).createOrder(input, customer);
    return NextResponse.json(result, {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    });
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
