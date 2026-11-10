import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  dataProvider,
  assertAdapterAvailable,
} from "./server/persistence/config";
export async function proxy(request: NextRequest) {
  if (
    process.env.DEPLOYMENT_TARGET === "hostinger" &&
    process.env.NODE_ENV === "production" &&
    !request.nextUrl.pathname.startsWith("/_next/") &&
    request.nextUrl.pathname !== "/icon.svg"
  ) {
    try {
      assertAdapterAvailable(process.env);
    } catch {
      const headers = {
        "Cache-Control": "no-store",
        "Retry-After": "60",
        "X-Robots-Tag": "noindex",
      };
      return request.nextUrl.pathname.startsWith("/api/")
        ? NextResponse.json(
            { error: "STORE_NOT_CONFIGURED" },
            { status: 503, headers },
          )
        : new NextResponse(
            "Mağaza henüz yayına hazır değil. Lütfen daha sonra tekrar deneyin.",
            {
              status: 503,
              headers: {
                ...headers,
                "Content-Type": "text/plain; charset=utf-8",
              },
            },
          );
    }
  }
  let response = NextResponse.next({ request });
  if (dataProvider(process.env) !== "supabase") return response;
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  await client.auth.getUser();
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|images|uploads|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
