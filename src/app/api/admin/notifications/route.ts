import { NextResponse } from "next/server";
import { z } from "zod";
import { getRole, sameOrigin } from "@/lib/auth";
import { repository } from "@/server/persistence";
import {
  notificationReadiness,
  dispatchOrderNotices,
} from "@/server/order-notifications";
const id = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
export async function GET(req: Request) {
  if ((await getRole()) !== "admin")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    const orderId = id.parse(new URL(req.url).searchParams.get("order"));
    const notices = await (
      await repository("notifications")
    ).listNotices(orderId);
    return NextResponse.json(
      { ...notificationReadiness(), notices },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Bildirim durumu yüklenemedi." },
      { status: 503 },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req) || (await getRole()) !== "admin")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!notificationReadiness().ready)
    return NextResponse.json(
      { error: "E-posta servisi henüz bağlı değil." },
      { status: 409 },
    );
  try {
    const input = z
      .object({ order: id })
      .strict()
      .parse(await req.json());
    await (await repository("notifications")).retryNotices(input.order);
    await dispatchOrderNotices();
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Bildirim yeniden denenemedi." },
      { status: 503 },
    );
  }
}
