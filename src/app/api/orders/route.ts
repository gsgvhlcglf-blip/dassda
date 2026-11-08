import { NextResponse } from "next/server";
import { orderSchema } from "@/lib/validation";
import { sameOrigin, rateLimit } from "@/lib/auth";
import { repository } from "@/server/persistence";
import { getCustomer } from "@/lib/customer";
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!rateLimit("orders:" + req.headers.get("x-forwarded-for"), 5))
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const customer = await getCustomer();
  if (!customer)
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try {
    const input = orderSchema.parse(await req.json());
    const result = await (
      await repository("orders")
    ).createOrder(input, customer);
    return NextResponse.json(result, { status: 201 });
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
