import "server-only";
import { createHmac } from "node:crypto";
import { repository } from "../server/persistence";
export type Customer = { id: string; email: string };
export function customerToken(id: string) {
  const key = process.env.LOCAL_SESSION_SECRET;
  if (!key) throw Error("CUSTOMER_UNAVAILABLE");
  const payload = Buffer.from(
    JSON.stringify({ id, role: "customer", exp: Date.now() + 7 * 86400000 }),
  ).toString("base64url");
  return (
    payload + "." + createHmac("sha256", key).update(payload).digest("hex")
  );
}
export async function getCustomer(): Promise<Customer | null> {
  return (await repository("identity")).getCustomer();
}
