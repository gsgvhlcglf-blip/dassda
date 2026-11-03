import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isLive } from "@/lib/database";
export async function GET(req: Request) {
  const url = new URL(req.url),
    code = url.searchParams.get("code");
  if (isLive && code) {
    const { error } = await (
      await supabase()
    ).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/hesabim", url.origin));
  }
  return NextResponse.redirect(
    new URL("/giris?verification=failed", url.origin),
  );
}
