import { spawn } from "node:child_process";
import { packageHostinger } from "./package-hostinger.mjs";
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build", "--webpack"],
  { stdio: "inherit", env: { ...process.env, DEPLOYMENT_TARGET: "hostinger" } },
);
const code = await new Promise((resolve) => child.once("exit", resolve));
if (code !== 0) process.exitCode = Number(code) || 1;
else console.log("Hostinger application bundle:", await packageHostinger());
