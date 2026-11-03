import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isLive, localEnabled } from "./database";
import { supabase } from "./supabase";
const secret = () => process.env.LOCAL_SESSION_SECRET || "";
export function equal(a: string, b: string) {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function signSession() {
  const payload = Buffer.from(
    JSON.stringify({ role: "admin", exp: Date.now() + 8 * 3600000 }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("hex")}`;
}
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
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const host = req.headers.get("host");
    const configured = process.env.NEXT_PUBLIC_SITE_URL;
    return configured
      ? parsed.origin === new URL(configured).origin
      : parsed.host === host && parsed.protocol === new URL(req.url).protocol;
  } catch {
    return false;
  }
}
const limits = new Map<string, { n: number; until: number }>();
export function rateLimit(key: string, max = 10) {
  const now = Date.now();
  if (limits.size > 5000)
    for (const [k, v] of limits) if (v.until < now) limits.delete(k);
  let v = limits.get(key);
  if (!v || v.until < now) {
    v = { n: 0, until: now + 60000 };
    limits.set(key, v);
  }
  return ++v.n <= max;
}
