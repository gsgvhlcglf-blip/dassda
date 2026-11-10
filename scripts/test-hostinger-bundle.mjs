import assert from "node:assert/strict";
import { readdir, access, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import path from "node:path";
const root = path.resolve("artifacts/hostinger");
for (const file of [
  "server.js",
  ".next/BUILD_ID",
  "public/icon.svg",
  "node_modules/nodemailer/package.json",
])
  await access(path.join(root, file));
const names = await readdir(root, { recursive: true });
assert(
  !names.some((name) =>
    name
      .split(path.sep)
      .some(
        (part) =>
          part.startsWith(".env") ||
          [".data", "uploads", "docs"].includes(part),
      ),
  ),
);
assert.equal(
  JSON.parse(await readFile(path.join(root, ".hostinger-build.json"), "utf8"))
    .target,
  "hostinger",
);
const socket = createServer();
await new Promise((r) => socket.listen(0, "127.0.0.1", r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
const child = spawn(process.execPath, [path.join(root, "server.js")], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: "production",
    DEPLOYMENT_TARGET: "hostinger",
    DATA_PROVIDER: "mysql",
    ALLOW_LOCAL_DEMO: "false",
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    CRON_SECRET: "",
    EMAIL_PROVIDER: "disabled",
    SMTP_PASSWORD: "",
    RESEND_API_KEY: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let diagnostic = "";
child.stdout.on("data", (c) => (diagnostic = (diagnostic + c).slice(-4000)));
child.stderr.on("data", (c) => (diagnostic = (diagnostic + c).slice(-4000)));
try {
  const base = "http://127.0.0.1:" + port;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/icon.svg")).status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert(ready, "Standalone server did not start");
  const privateJob = await fetch(base + "/api/notifications/dispatch");
  assert.equal(privateJob.status, 503);
  assert.equal((await privateJob.json()).error, "STORE_NOT_CONFIGURED");
  // The prepared MySQL profile must not expose demonstration inventory as a working shop.
  assert.equal((await fetch(base + "/urunler")).status, 503);
  console.log(
    "PASS: Hostinger standalone serves assets, includes SMTP runtime, excludes private files and refuses an unconfigured MySQL store.",
  );
} finally {
  child.kill("SIGTERM");
  if (child.exitCode === null) await new Promise((r) => child.once("exit", r));
}
