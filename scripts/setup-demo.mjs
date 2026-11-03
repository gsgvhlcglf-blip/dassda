import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { hashLocalPassword } from "../src/lib/local-password.mjs";
if (process.env.NODE_ENV === "production")
  throw new Error("Local demo credentials must not be generated in production");
if (existsSync(".env.local")) {
  // Drain password input if a caller already supplied it; never display it.
  if (process.argv.includes("--password-stdin")) readFileSync(0, "utf8");
  console.log(".env.local already exists; preserved.");
} else {
  const chosen = process.argv.includes("--password-stdin");
  const credential = chosen
    ? `LOCAL_ADMIN_PASSWORD_HASH=${hashLocalPassword(readFileSync(0, "utf8").replace(/\r?\n$/, ""))}`
    : `LOCAL_ADMIN_PASSWORD=${randomBytes(18).toString("base64url")}`;
  writeFileSync(
    ".env.local",
    `ALLOW_LOCAL_DEMO=true\n${credential}\nLOCAL_SESSION_SECRET=${randomBytes(32).toString("hex")}\nNEXT_TELEMETRY_DISABLED=1\n`,
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    chosen
      ? "Yerel yonetim sifreniz kaydedildi. E-posta: demo@local.test."
      : "Private demo credentials generated in .env.local. Use LOCAL_ADMIN_PASSWORD to sign into /admin with demo@local.test. Never commit this file.",
  );
}
