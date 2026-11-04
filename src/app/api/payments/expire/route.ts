import { equal } from "@/lib/auth";
import { expirePayments } from "@/lib/payments/store";
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return Response.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  if (!equal(req.headers.get("authorization") || "", "Bearer " + secret))
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    return Response.json(
      { released: await expirePayments() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "EXPIRY_FAILED" }, { status: 503 });
  }
}
