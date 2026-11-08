import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { isLive, localEnabled, localDB } from "@/lib/database";
import { supabase } from "@/lib/supabase";
import { signSession, equal } from "@/lib/auth";
import { customerToken, type Customer } from "@/lib/customer";
import {
  hashLocalPassword,
  verifyLocalPassword,
} from "@/lib/local-password.mjs";
import { RepositoryError, type CustomerOrder } from "../../contracts";
const secret = () => process.env.LOCAL_SESSION_SECRET || "";
export async function getRole(): Promise<"admin" | "editor" | null> {
  if (isLive) {
    const s = await supabase();
    const {
      data: { user },
    } = await s.auth.getUser();
    if (!user) return null;
    const { data } = await s
      .from("admin_users")
      .select("role")
      .eq("user_id", user.id)
      .single();
    return data?.role === "admin" || data?.role === "editor" ? data.role : null;
  }
  if (!localEnabled || !secret()) return null;
  const cookie = (await cookies()).get("kz_session")?.value;
  if (!cookie) return null;
  const [payload, sig] = cookie.split(".");
  if (
    !sig ||
    !equal(sig, createHmac("sha256", secret()).update(payload).digest("hex"))
  )
    return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()).exp >
      Date.now()
      ? "admin"
      : null;
  } catch {
    return null;
  }
}
export async function getCustomer(): Promise<Customer | null> {
  if (isLive) {
    const {
      data: { user },
    } = await (await supabase()).auth.getUser();
    return user?.email && user.email_confirmed_at
      ? { id: user.id, email: user.email }
      : null;
  }
  if (!localEnabled || !process.env.LOCAL_SESSION_SECRET) return null;
  const token = (await cookies()).get("kz_customer")?.value;
  if (!token) return null;
  try {
    const [payload, signature] = token.split(".");
    const expected = createHmac("sha256", process.env.LOCAL_SESSION_SECRET)
      .update(payload)
      .digest();
    const actual = Buffer.from(signature, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.role !== "customer" || data.exp <= Date.now()) return null;
    const row = localDB()
      .prepare("SELECT id,email FROM customers WHERE id=?")
      .get(data.id) as Customer | undefined;
    return row ? { id: row.id, email: row.email } : null;
  } catch {
    return null;
  }
}

export async function getStaffActor() {
  if (!isLive) return "local-admin";
  const user = (await (await supabase()).auth.getUser()).data.user;
  if (!user) throw new RepositoryError("Yetki doğrulanamadı.", 401);
  return user.id;
}

export async function loginStaff(email: string, password: string) {
  if (isLive) {
    const s = await supabase();
    const { error } = await s.auth.signInWithPassword({ email, password });
    if (error) throw new RepositoryError("E-posta veya şifre hatalı.", 401);
    if (!(await getRole())) {
      await s.auth.signOut();
      throw new RepositoryError("Yönetim yetkisi bulunamadı.", 403);
    }
    return;
  }
  if (
    !localEnabled ||
    (!process.env.LOCAL_ADMIN_PASSWORD &&
      !process.env.LOCAL_ADMIN_PASSWORD_HASH) ||
    !secret()
  )
    throw new RepositoryError(
      "Yerel yönetim için npm run setup:demo komutunu çalıştırın.",
      503,
    );
  if (
    email !== "demo@local.test" ||
    typeof password !== "string" ||
    (process.env.LOCAL_ADMIN_PASSWORD_HASH
      ? !verifyLocalPassword(password, process.env.LOCAL_ADMIN_PASSWORD_HASH)
      : !equal(password, process.env.LOCAL_ADMIN_PASSWORD || ""))
  )
    throw new RepositoryError("E-posta veya şifre hatalı.", 401);
  (await cookies()).set("kz_session", signSession(), {
    httpOnly: true,
    secure: !localEnabled && process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 28800,
  });
}

export async function logoutStaff() {
  if (isLive) await (await supabase()).auth.signOut();
  (await cookies()).delete("kz_session");
}

export async function authenticateCustomer(
  email: string,
  password: string,
  signup: boolean,
  redirectUrl: string,
): Promise<{ ok: true; verify?: boolean; demo?: boolean }> {
  if (isLive) {
    const s = await supabase();
    if (signup) {
      const { data, error } = await s.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectUrl },
      });
      if (error) throw new RepositoryError("SIGNUP_FAILED");
      return { ok: true, verify: !data.session };
    }
    const { data, error } = await s.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user?.email_confirmed_at)
      throw new RepositoryError("INVALID_LOGIN", 401);
    return { ok: true };
  }
  if (!localEnabled || !secret())
    throw new RepositoryError("CUSTOMER_UNAVAILABLE", 503);
  const db = localDB();
  let customer = db
    .prepare("SELECT id,password_hash FROM customers WHERE email=?")
    .get(email) as { id: string; password_hash: string } | undefined;
  if (signup) {
    if (customer) throw new RepositoryError("SIGNUP_FAILED");
    customer = { id: randomUUID(), password_hash: hashLocalPassword(password) };
    db.prepare(
      "INSERT INTO customers(id,email,password_hash) VALUES(?,?,?)",
    ).run(customer.id, email, customer.password_hash);
  } else if (
    !customer ||
    !verifyLocalPassword(password, customer.password_hash)
  ) {
    throw new RepositoryError("INVALID_LOGIN", 401);
  }
  (await cookies()).set("kz_customer", customerToken(customer.id), {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400,
  });
  return { ok: true, demo: true };
}

export async function logoutCustomer() {
  if (isLive) await (await supabase()).auth.signOut();
  (await cookies()).delete("kz_customer");
}

export async function customerOrders(
  customerId: string,
): Promise<CustomerOrder[]> {
  // Initialize optional payment columns for pre-payment local databases.
  if (!isLive)
    await import("@/lib/payments/store").then((m) => m.getPaymentSettings());
  if (isLive) {
    const { data, error } = await (
      await supabase()
    )
      .from("orders")
      .select(
        "reference,status,total,currency,created_at,payment_status,payment_provider",
      )
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new RepositoryError("ORDERS_UNAVAILABLE", 503);
    return data;
  }
  return localDB()
    .prepare(
      "SELECT reference,status,total,currency,created_at,payment_status,payment_provider FROM orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 50",
    )
    .all(customerId) as unknown as CustomerOrder[];
}
