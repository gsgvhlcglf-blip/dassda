import { NextResponse } from "next/server";
import { z } from "zod";
import { getGuest } from "@/server/guest-session";
import {
  findPayment,
  paymentOrder,
  expirePayments,
} from "@/lib/payments/store";
export async function GET(req: Request) {
  const customer = await getGuest();
  if (!customer)
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try {
    const id = z.uuid().parse(new URL(req.url).searchParams.get("id"));
    await expirePayments();
    const a = await findPayment(id);
    if (!a || a.guest_key !== customer.guestKey)
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const order = await paymentOrder(a);
    return NextResponse.json(
      {
        id: a.id,
        reference: order.reference,
        state: a.state,
        mode: a.mode,
        provider: a.provider,
        amountMinor: a.amount_minor,
        currency: a.currency,
        checkoutUrl: a.state === "ready" ? a.checkout_url : null,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "PAYMENT_STATUS_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
