import { NextResponse } from "next/server";
import { z } from "zod";
import { getRole, sameOrigin } from "@/lib/auth";
import { emailDesignSchema } from "@/lib/email-design";
import { repository } from "@/server/persistence";
export async function GET() {
  if ((await getRole()) !== "admin")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    return NextResponse.json(
      await (await repository("notifications")).getEmailDesign(),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "E-posta ayarları yüklenemedi." },
      { status: 503 },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req) || (await getRole()) !== "admin")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    const body = await req.text();
    if (body.length > 15000) throw Error("Ayarlar çok uzun.");
    const input = z
      .object({
        expected: z.number().int().min(0),
        settings: emailDesignSchema,
      })
      .strict()
      .parse(JSON.parse(body));
    const result = await (
      await repository("notifications")
    ).saveEmailDesign(input.expected, input.settings);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    const conflict =
      e instanceof Error && e.message === "EMAIL_DESIGN_CONFLICT";
    return NextResponse.json(
      {
        error: conflict
          ? "E-posta ayarları başka sekmede değişti. Yenileyip tekrar deneyin."
          : "Geçerli e-posta ayarları girin.",
      },
      { status: conflict ? 409 : 400 },
    );
  }
}
