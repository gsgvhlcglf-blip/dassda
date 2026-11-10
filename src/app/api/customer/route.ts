import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/auth";
import { repository } from "@/server/persistence";
const disabled = () =>
  NextResponse.json(
    { error: "CUSTOMER_ACCOUNTS_DISABLED" },
    {
      status: 410,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
export const GET = disabled;
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    if ((await req.json()).action === "logout") {
      await (await repository("identity")).logoutCustomer();
      return NextResponse.json({ ok: true });
    }
  } catch {
    /* Invalid and disabled account actions never authenticate a customer. */
  }
  return disabled();
}
