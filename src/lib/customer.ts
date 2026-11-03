import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { isLive, localEnabled, localDB } from "./database";
import { supabase } from "./supabase";
export type Customer = { id: string; email: string };
export function customerToken(id: string) {
  const key = process.env.LOCAL_SESSION_SECRET;
  if (!key) throw Error("CUSTOMER_UNAVAILABLE");
  const payload = Buffer.from(
    JSON.stringify({ id, role: "customer", exp: Date.now() + 7 * 86400000 }),
  ).toString("base64url");
  return (
    payload + "." + createHmac("sha256", key).update(payload).digest("hex")
  );
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
