import { equal } from "@/lib/auth";
import {
  dispatchOrderNotices,
  notificationReadiness,
} from "@/server/order-notifications";
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return Response.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  if (!equal(req.headers.get("authorization") || "", "Bearer " + secret))
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!(await notificationReadiness()).ready)
    return Response.json({ error: "EMAIL_NOT_CONFIGURED" }, { status: 503 });
  try {
    return Response.json(await dispatchOrderNotices(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "DISPATCH_FAILED" }, { status: 503 });
  }
}
