import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
const server = path.resolve("artifacts/hostinger/server.js");
await access(server);
const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    DEPLOYMENT_TARGET: "hostinger",
    HOSTNAME: process.env.HOSTINGER_BIND_HOST || "0.0.0.0",
  },
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => child.kill(signal));
child.once("exit", (code, signal) => {
  process.exitCode = signal ? 1 : code || 0;
});
