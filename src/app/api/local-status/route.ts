import { NextResponse } from "next/server";
import { isLive, localEnabled, rowsLocal } from "@/lib/database";
import { installationId } from "@/lib/local-installation.mjs";
export const dynamic = "force-dynamic";
export async function GET() {
  if (isLive || !localEnabled) return new NextResponse(null, { status: 404 });
  try {
    rowsLocal("brands");
    return NextResponse.json(
      { app: "kuzmin-local", installation: installationId(), ready: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ready: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
