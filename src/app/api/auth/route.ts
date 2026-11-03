import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { equal, signSession, rateLimit, sameOrigin } from "@/lib/auth";
import { isLive, localEnabled } from "@/lib/database";
import { verifyLocalPassword } from "@/lib/local-password.mjs";
import { supabase } from "@/lib/supabase";
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!rateLimit("login:" + req.headers.get("x-forwarded-for"), 5))
    return NextResponse.json(
      { error: "Çok fazla deneme. Bir dakika bekleyin." },
      { status: 429 },
    );
  try {
    const { email, password, logout } = await req.json();
    if (logout) {
      if (isLive) await (await supabase()).auth.signOut();
      (await cookies()).delete("kz_session");
      return NextResponse.json({ ok: true });
    }
    if (isLive) {
      const s = await supabase();
      const { error } = await s.auth.signInWithPassword({ email, password });
      if (error)
        return NextResponse.json(
          { error: "E-posta veya şifre hatalı." },
          { status: 401 },
        );
      const { getRole } = await import("@/lib/auth");
      if (!(await getRole())) {
        await s.auth.signOut();
        return NextResponse.json(
          { error: "Yönetim yetkisi bulunamadı." },
          { status: 403 },
        );
      }
    } else {
      if (
        !localEnabled ||
        (!process.env.LOCAL_ADMIN_PASSWORD &&
          !process.env.LOCAL_ADMIN_PASSWORD_HASH) ||
        !process.env.LOCAL_SESSION_SECRET
      )
        return NextResponse.json(
          {
            error: "Yerel yönetim için npm run setup:demo komutunu çalıştırın.",
          },
          { status: 503 },
        );
      if (
        email !== "demo@local.test" ||
        typeof password !== "string" ||
        (process.env.LOCAL_ADMIN_PASSWORD_HASH
          ? !verifyLocalPassword(
              password,
              process.env.LOCAL_ADMIN_PASSWORD_HASH,
            )
          : !equal(password, process.env.LOCAL_ADMIN_PASSWORD || ""))
      )
        return NextResponse.json(
          { error: "E-posta veya şifre hatalı." },
          { status: 401 },
        );
      (await cookies()).set("kz_session", signSession(), {
        httpOnly: true,
        secure: !localEnabled && process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 28800,
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "İstek işlenemedi." }, { status: 400 });
  }
}
