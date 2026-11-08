import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtempSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
const root = process.cwd(),
  directory = mkdtempSync(join(tmpdir(), "kuzmin-analytics-"));
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
const processServer = spawn(
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
    stdio: ["ignore", "pipe", "pipe"],
  },
);
const origin = "http://127.0.0.1:" + port;
let browser;
let log = "";
processServer.stdout.on("data", (chunk) => (log += chunk));
processServer.stderr.on("data", (chunk) => (log += chunk));
try {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(origin + "/api/analytics/settings")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
    if (i === 149) throw Error("Test server did not start: " + log);
  }
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const admin = await browser.newContext(),
    page = await admin.newPage(),
    visitorContext = await browser.newContext(),
    visitor = await visitorContext.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  visitor.on("pageerror", (e) => errors.push(e.message));
  assert.equal(
    (
      await visitorContext.request.get(origin + "/api/admin/analytics")
    ).status(),
    403,
  );
  const deniedMap = await visitorContext.request.get(
    origin + "/analitik-onizleme",
  );
  const deniedBody = await deniedMap.text();
  assert.match(deniedBody, /404/);
  assert(!deniedBody.includes("data-analytics-heatmap"));
  assert(!deniedBody.includes('class="hero"'));

  assert.equal(
    (
      await visitorContext.request.post(origin + "/api/admin/analytics", {
        data: { action: "settings", enabled: true, retentionDays: 30 },
      })
    ).status(),
    403,
  );
  await page.goto(origin + "/admin");
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await page
    .getByRole("button", { name: "Analitik & Isı Haritası", exact: true })
    .click();
  await page.getByRole("button", { name: "Kaydı aç", exact: true }).click();
  await visitor.goto(origin);
  await visitor
    .getByRole("button", { name: "Kabul et", exact: true })
    .waitFor();
  const report = async () =>
    await (
      await admin.request.get(origin + "/api/admin/analytics?days=7")
    ).json();
  assert.equal((await report()).report.totals.pageviews, 0);
  await visitor.getByRole("button", { name: "Kabul et", exact: true }).click();
  await visitor.locator(".hero h1").click();
  await visitor.waitForTimeout(5400);
  const first = await report();
  assert.equal(first.report.totals.pageviews, 1);
  assert.equal(first.report.totals.clicks, 1);
  await visitor.evaluate(() => {
    const form = document.createElement("form");
    form.innerHTML = '<input aria-label="Privacy test" value="">';
    document.body.appendChild(form);
  });
  await visitor.getByLabel("Privacy test").fill("PRIVATE_FORM_SENTINEL");
  await visitor.getByLabel("Privacy test").click();
  await visitor.waitForTimeout(5200);
  assert.equal((await report()).report.totals.clicks, 1);
  const privateEvent = {
    id: randomUUID(),
    session_id: randomUUID(),
    kind: "pageview",
    path: "/odeme",
    viewport_width: 1280,
    viewport_height: 900,
    document_width: 1280,
    document_height: 3000,
    x: null,
    y: null,
    depth: 0.3,
    referrer_host: "",
    revision: "test",
  };
  assert.equal(
    (
      await visitorContext.request.post(origin + "/api/analytics", {
        data: { consent: true, events: [privateEvent] },
      })
    ).status(),
    400,
  );
  assert.equal(
    (
      await visitorContext.request.post(origin + "/api/analytics", {
        data: { consent: false, events: [{ ...privateEvent, path: "/" }] },
      })
    ).status(),
    400,
  );
  assert.equal(
    (
      await admin.request.post(origin + "/api/admin/analytics", {
        headers: { Origin: "https://foreign.invalid" },
        data: { action: "clear" },
      })
    ).status(),
    403,
  );
  const heatResponse = await admin.request.get(
    origin + "/analitik-onizleme?path=%2F",
  );
  assert.equal(heatResponse.headers()["x-frame-options"], "SAMEORIGIN");
  assert.match(
    heatResponse.headers()["content-security-policy"],
    /frame-ancestors 'self'/,
  );
  await page.getByRole("button", { name: "Yenile", exact: true }).click();
  await page
    .frameLocator("iframe")
    .locator("[data-analytics-heatmap]")
    .waitFor();
  await page.screenshot({
    path: "/tmp/kuzmin-analytics-desktop.png",
    fullPage: true,
  });
  const secondTab = await visitorContext.newPage();
  await secondTab.goto(origin);
  await secondTab.locator(".hero h1").waitFor();
  await secondTab
    .getByRole("button", { name: "Kabul et", exact: true })
    .waitFor();
  assert.equal((await report()).report.totals.pageviews, 1);
  await secondTab
    .getByRole("button", { name: "Kabul et", exact: true })
    .click();
  await secondTab.waitForTimeout(5200);
  assert.equal((await report()).report.totals.pageviews, 2);
  await visitor
    .getByRole("button", { name: "Çerez tercihleri", exact: true })
    .click();
  await visitor.getByRole("button", { name: "Reddet", exact: true }).click();
  await visitor.locator(".hero h1").click();
  await secondTab.locator(".hero h1").click();
  await visitor.waitForTimeout(5200);
  assert.equal((await report()).report.totals.clicks, 1);
  const db = new DatabaseSync(join(directory, ".data/store.sqlite"));
  const rows = db.prepare("select * from analytics_events").all();
  assert(rows.length >= 2);
  assert(!JSON.stringify(rows).includes("PRIVATE_FORM_SENTINEL"));
  db.close();
  assert.deepEqual(errors, []);
  console.log(
    "App analytics passed: authenticated admin, denied anonymous access, consent/revoke, private route exclusion, form privacy, real heatmap and framing policy.",
  );
} finally {
  if (browser) await browser.close();
  processServer.kill("SIGTERM");
  await new Promise((r) => processServer.once("exit", r));
  rmSync(directory, { recursive: true, force: true });
}
