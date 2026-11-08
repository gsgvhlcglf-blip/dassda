import { NextResponse } from "next/server";
import { rateLimit, sameOrigin } from "@/lib/auth";
import { repository } from "@/server/persistence";
import { RepositoryError } from "@/server/persistence/contracts";
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
    const identity = await repository("identity");
    if (logout) await identity.logoutStaff();
    else await identity.loginStaff(email, password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RepositoryError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json({ error: "İstek işlenemedi." }, { status: 400 });
  }
}
