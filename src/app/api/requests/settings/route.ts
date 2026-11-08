import { NextResponse } from "next/server";
import { workReadiness } from "@/lib/request-store";
import { isDemo } from "@/lib/database";
export async function GET() {
  try {
    const terms = await workReadiness();
    return NextResponse.json(
      {
        ready: true,
        demo: isDemo,
        version: terms.version,
        documents: Object.fromEntries(
          Object.entries(terms.documents).filter(
            ([, d]) => d.approved && d.text.trim(),
          ),
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ready: false, error: "Talep hizmeti henüz yapılandırılmadı." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
