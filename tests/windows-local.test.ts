import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  hashLocalPassword,
  verifyLocalPassword,
} from "../src/lib/local-password.mjs";
import { installationId } from "../src/lib/local-installation.mjs";

test("chosen local passwords are salted, checked and never accepted from malformed hashes", () => {
  const password = "Local test pass ! # $ %";
  const hash = hashLocalPassword(password);
  assert.ok(verifyLocalPassword(password, hash));
  assert.equal(verifyLocalPassword("wrong password", hash), false);
  assert.notEqual(hashLocalPassword(password), hash);
  assert.equal(verifyLocalPassword(password, "malformed"), false);
  assert.throws(() => hashLocalPassword("short"));
  assert.throws(() => hashLocalPassword("x".repeat(129)));
});
test("Windows setup accepts private stdin, stores only a hash and preserves existing files", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "KUZMIN Windows test "));
  try {
    const password = "Yerel Test Sifre !#$%";
    const script = path.resolve("scripts/setup-demo.mjs");
    const env = { ...process.env, NODE_ENV: "development" as const };
    const result = spawnSync(process.execPath, [script, "--password-stdin"], {
      cwd: dir,
      env,
      input: password + "\r\n",
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!result.stdout.includes(password));
    const config = readFileSync(path.join(dir, ".env.local"), "utf8");
    assert.ok(!config.includes(password));
    const hash = config.match(/^LOCAL_ADMIN_PASSWORD_HASH=(.+)$/m)?.[1];
    assert.ok(hash);
    assert.ok(verifyLocalPassword(password, hash));
    const again = spawnSync(process.execPath, [script, "--password-stdin"], {
      cwd: dir,
      env,
      input: "Different password 123\n",
      encoding: "utf8",
    });
    assert.equal(again.status, 0);
    assert.equal(readFileSync(path.join(dir, ".env.local"), "utf8"), config);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("installation identity follows folder location", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "KUZMIN id "));
  try {
    assert.equal(installationId(dir), installationId(dir));
    assert.notEqual(installationId(dir), installationId());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("local port selection reuses this installation and skips unrelated services", async () => {
  const { createServer } = await import("node:http");
  const { selectLocalPort } = await import("../scripts/local-runtime.mjs");
  const root = process.cwd();
  const directory = mkdtempSync(path.join(tmpdir(), "KUZMIN other "));
  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        app: "kuzmin-local",
        installation: installationId(root),
        ready: true,
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as import("node:net").AddressInfo).port;
    if (port > 65525) return;
    assert.deepEqual(await selectLocalPort(root, port), {
      port,
      existing: true,
    });
    const other = await selectLocalPort(directory, port);
    assert.equal(other.existing, false);
    assert.notEqual(other.port, port);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
    rmSync(directory, { recursive: true, force: true });
  }
});
