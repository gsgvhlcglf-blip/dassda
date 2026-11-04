import { spawn } from "node:child_process";
import { mkdtempSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
export async function testAppServer() {
  const root = process.cwd(),
    directory = mkdtempSync(join(tmpdir(), "kuzmin-studio-"));
  for (const file of [
    ".next",
    "node_modules",
    "public",
    "next.config.ts",
    "package.json",
  ])
    symlinkSync(resolve(file), join(directory, file));
  const socket = createServer();
  await new Promise((r) => socket.listen(0, "127.0.0.1", r));
  const port = socket.address().port;
  await new Promise((r) => socket.close(r));
  const password = randomBytes(24).toString("hex");
  const child = spawn(
    process.execPath,
    [
      join(root, "node_modules/next/dist/bin/next"),
      "start",
      "-H",
      "127.0.0.1",
      "-p",
      String(port),
    ],
    {
      cwd: directory,
      env: {
        ...process.env,
        ALLOW_LOCAL_DEMO: "true",
        LOCAL_ADMIN_PASSWORD: password,
        LOCAL_ADMIN_PASSWORD_HASH: "",
        LOCAL_SESSION_SECRET: randomBytes(32).toString("hex"),
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
        NEXT_PUBLIC_SITE_URL: "",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "ignore", "ignore"],
    },
  );
  const origin = "http://127.0.0.1:" + port;
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(origin + "/api/analytics/settings")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
    if (i === 149) {
      child.kill();
      rmSync(directory, { recursive: true, force: true });
      throw Error("Test server did not start");
    }
  }
  return {
    origin,
    password,
    directory,
    async stop() {
      child.kill("SIGTERM");
      if (child.exitCode === null)
        await new Promise((r) => child.once("exit", r));
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
