import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin, rateLimit } from "@/lib/auth";
import { getCustomer } from "@/lib/customer";
import { repository } from "@/server/persistence";
import { RepositoryError } from "@/server/persistence/contracts";
const schema = z.object({
  action: z.enum(["signup", "login", "logout"]),
  email: z.email().max(254).optional(),
  password: z.string().min(12).max(128).optional(),
  consent: z.boolean().optional(),
});
export async function GET() {
  const user = await getCustomer();
  if (!user)
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try {
    const orders = await (await repository("identity")).customerOrders(user.id);
    return NextResponse.json(
      { user, orders },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "ORDERS_UNAVAILABLE" }, { status: 503 });
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!rateLimit("customer:" + req.headers.get("x-forwarded-for"), 10))
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  try {
    const input = schema.parse(await req.json());
    const identity = await repository("identity");
    if (input.action === "logout") {
      await identity.logoutCustomer();
      return NextResponse.json({ ok: true });
    }
    if (
      !input.email ||
      !input.password ||
      (input.action === "signup" && !input.consent)
    )
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    const result = await identity.authenticateCustomer(
      input.email.trim().toLowerCase(),
      input.password,
      input.action === "signup",
      new URL("/auth/callback", process.env.NEXT_PUBLIC_SITE_URL || req.url)
        .href,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RepositoryError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
}
