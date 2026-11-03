// Developer verification: requires installed dependencies and a completed build.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { hashLocalPassword } from "../src/lib/local-password.mjs";
import { probeInstallation } from "./local-runtime.mjs";
const password = randomBytes(24).toString("base64url");
const env = {
  ...process.env,
  KUZMIN_LOCAL_PORT: process.env.KUZMIN_LOCAL_PORT || "4310",
  LOCAL_ADMIN_PASSWORD: password,
  LOCAL_ADMIN_PASSWORD_HASH: hashLocalPassword(password),
  LOCAL_SESSION_SECRET: randomBytes(32).toString("hex"),
  TEST_BASE_URL: `http://localhost:${process.env.KUZMIN_LOCAL_PORT || 4310}`,
  KUZMIN_TEST_LOCAL_PASSWORD: password,
};
const child = spawn(
  process.execPath,
  ["scripts/local-server.mjs", "--no-browser"],
  { env, stdio: "inherit" },
);
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error("Local launcher exited early");
    if (await probeInstallation(Number(env.KUZMIN_LOCAL_PORT), process.cwd())) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!ready) throw new Error("Local launcher readiness timed out");
  const duplicate = spawnSync(
    process.execPath,
    ["scripts/local-server.mjs", "--admin", "--no-browser"],
    { env, encoding: "utf8", timeout: 20000 },
  );
  if (duplicate.status !== 0 || !duplicate.stdout.includes("zaten acik"))
    throw new Error(
      "Duplicate local launcher did not reuse its existing server",
    );
  console.log(
    "Duplicate launch verified; testing the browser and chosen-password login.",
  );
  const runner = spawn(
    process.execPath,
    ["node_modules/playwright/cli.js", "test"],
    { env, stdio: "inherit" },
  );
  const [code] = await once(runner, "exit");
  if (code !== 0) throw new Error("Browser verification failed");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (child.exitCode === null) {
    const closed = once(child, "exit");
    child.kill("SIGTERM");
    await closed;
  }
}
