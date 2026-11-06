import { NextResponse } from "next/server";
import { workTerms } from "@/lib/request-store";
import { isLive } from "@/lib/database";
export async function GET() {
  try {
    const terms = await workTerms();
    return NextResponse.json(
      {
        ready: true,
        demo: !isLive,
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
