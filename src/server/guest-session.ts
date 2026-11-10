import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

/** An opaque checkout session, not a customer account. Only its hash is persisted. */
export async function getGuest(
  create = false,
): Promise<{ guestKey: string } | null> {
  const jar = await cookies();
  let token = jar.get("kz_guest")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    if (!create) return null;
    token = randomBytes(32).toString("hex");
    jar.set("kz_guest", token, {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production" &&
        process.env.ALLOW_LOCAL_DEMO !== "true",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 86400,
    });
  }
  return { guestKey: createHash("sha256").update(token).digest("hex") };
}
