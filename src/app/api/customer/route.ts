import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sameOrigin, rateLimit } from "@/lib/auth";
import { getCustomer, customerToken } from "@/lib/customer";
import { isLive, localEnabled, localDB } from "@/lib/database";
import {
  hashLocalPassword,
  verifyLocalPassword,
} from "@/lib/local-password.mjs";
import { supabase } from "@/lib/supabase";
const schema = z.object({
  action: z.enum(["signup", "login", "logout"]),
  email: z.email().max(254).optional(),
  password: z.string().min(12).max(128).optional(),
  consent: z.boolean().optional(),
});
export async function GET() {
  await import("@/lib/payments/store")
    .then((m) => m.getPaymentSettings())
    .catch(() => {});
  const user = await getCustomer();
  if (!user)
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (isLive) {
    const { data, error } = await (
      await supabase()
    )
      .from("orders")
      .select(
        "reference,status,total,currency,created_at,payment_status,payment_provider",
      )
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error)
      return NextResponse.json(
        { error: "ORDERS_UNAVAILABLE" },
        { status: 503 },
      );
    return NextResponse.json(
      { user, orders: data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return NextResponse.json(
    {
      user,
      orders: localDB()
        .prepare(
          "SELECT reference,status,total,currency,created_at,payment_status,payment_provider FROM orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 50",
        )
        .all(user.id),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!rateLimit("customer:" + req.headers.get("x-forwarded-for"), 10))
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  try {
    const input = schema.parse(await req.json());
    if (input.action === "logout") {
      if (isLive) await (await supabase()).auth.signOut();
      (await cookies()).delete("kz_customer");
      return NextResponse.json({ ok: true });
    }
    if (
      !input.email ||
      !input.password ||
      (input.action === "signup" && !input.consent)
    )
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    const email = input.email.trim().toLowerCase();
    if (isLive) {
      const s = await supabase();
      if (input.action === "signup") {
        const { data, error } = await s.auth.signUp({
          email,
          password: input.password,
          options: {
            emailRedirectTo: new URL(
              "/auth/callback",
              process.env.NEXT_PUBLIC_SITE_URL || req.url,
            ).href,
          },
        });
        if (error)
          return NextResponse.json({ error: "SIGNUP_FAILED" }, { status: 400 });
        return NextResponse.json({ ok: true, verify: !data.session });
      }
      const { data, error } = await s.auth.signInWithPassword({
        email,
        password: input.password,
      });
      if (error || !data.user?.email_confirmed_at)
        return NextResponse.json({ error: "INVALID_LOGIN" }, { status: 401 });
      return NextResponse.json({ ok: true });
    }
    if (!localEnabled || !process.env.LOCAL_SESSION_SECRET)
      return NextResponse.json(
        { error: "CUSTOMER_UNAVAILABLE" },
        { status: 503 },
      );
    const db = localDB();
    let customer = db
      .prepare("SELECT id,password_hash FROM customers WHERE email=?")
      .get(email) as { id: string; password_hash: string } | undefined;
    if (input.action === "signup") {
      if (customer)
        return NextResponse.json({ error: "SIGNUP_FAILED" }, { status: 400 });
      customer = {
        id: randomUUID(),
        password_hash: hashLocalPassword(input.password),
      };
      db.prepare(
        "INSERT INTO customers(id,email,password_hash) VALUES(?,?,?)",
      ).run(customer.id, email, customer.password_hash);
    } else if (
      !customer ||
      !verifyLocalPassword(input.password, customer.password_hash)
    )
      return NextResponse.json({ error: "INVALID_LOGIN" }, { status: 401 });
    (await cookies()).set("kz_customer", customerToken(customer.id), {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 86400,
    });
    return NextResponse.json({ ok: true, demo: true });
  } catch {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
}
