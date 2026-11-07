import { chromium, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import assert from "node:assert/strict";
import { testAppServer } from "./test-app-server.mjs";
const app = process.argv.includes("--app");
let server, origin;
if (app) {
  server = await testAppServer();
  origin = server.origin;
} else {
  server = createServer((req, res) => {
    const p = new URL(req.url, "http://localhost").pathname;
    if (!/^\/docs\/(panel\.html|store\.html|panel-version\.json)$/.test(p))
      return res.writeHead(404).end();
    res.setHeader(
      "Content-Type",
      p.endsWith("json") ? "application/json" : "text/html; charset=utf-8",
    );
    res.end(readFileSync("." + p));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = "http://127.0.0.1:" + server.address().port;
}
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
let uploadedPath;
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + (app ? "/" : "/docs/panel.html"));
  const fixture = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 36;
    const ctx = canvas.getContext("2d"),
      stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8",
      }),
      chunks = [];
    const stopped = new Promise((resolve) => {
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = resolve;
    });
    ctx.fillStyle = "#555";
    ctx.fillRect(0, 0, 64, 36);
    recorder.start(100);
    const timer = setInterval(() => {
      ctx.fillStyle = Math.random() > 0.5 ? "#333" : "#777";
      ctx.fillRect(0, 0, 64, 36);
    }, 80);
    await new Promise((r) => setTimeout(r, 650));
    recorder.stop();
    await stopped;
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    const bytes = new Uint8Array(
      await new Blob(chunks, { type: "video/webm" }).arrayBuffer(),
    );
    return btoa(String.fromCharCode(...bytes));
  });
  const file = {
    name: "ornek-banner.webm",
    mimeType: "video/webm",
    buffer: Buffer.from(fixture, "base64"),
  };
  const view = () => (app ? page : page.frameLocator("#site-frame"));
  await expect(view().locator(".home-photo-slot img")).toHaveCount(4);
  const spacing = await view()
    .locator("#main")
    .evaluate((main) => {
      const hero = main.querySelector(".hero").getBoundingClientRect(),
        grid = main.querySelector(".home-photo-grid");
      return {
        top: grid.getBoundingClientRect().top - hero.bottom,
        gap: parseFloat(getComputedStyle(grid).gap),
      };
    });
  assert(spacing.top >= 70 && spacing.gap >= 24);
  if (app)
    await page.screenshot({
      path: "/tmp/home-curated-desktop.png",
      fullPage: true,
    });
  let video;
  if (app) {
    assert.equal(
      (
        await context.request.post(origin + "/api/upload-video", {
          multipart: { file },
        })
      ).status(),
      401,
    );
    await page.goto(origin + "/admin");
    await page.getByLabel("Şifre", { exact: true }).fill(server.password);
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await page
      .getByRole("button", { name: "Fotoğraf düzeni", exact: true })
      .click();
    await page
      .getByLabel("Banner videosu yükle", { exact: true })
      .setInputFiles(file);
    await page.getByText(file.name, { exact: true }).waitFor();
    let data = await (
      await context.request.get(origin + "/api/admin/studio")
    ).json();
    video = data.snapshot.design.heroVideo;
    assert(video.src.startsWith("/api/upload-video?file="));
    uploadedPath =
      "public/uploads/" + new URL(video.src, origin).searchParams.get("file");
    const saved = await context.request.get(origin + video.src);
    assert.equal(
      saved.status(),
      200,
      "Uploaded video must be publicly playable",
    );
    assert(saved.headers()["content-type"]?.startsWith("video/"));
    assert.equal((await saved.body()).length, file.buffer.length);
    const range = await context.request.get(origin + video.src, {
      headers: { Range: "bytes=0-15" },
    });
    assert.equal(range.status(), 206);
    assert.equal((await range.body()).length, 16);
    const publish = await context.request.post(origin + "/api/admin/studio", {
      data: { action: "publish", expectedRevision: data.revision },
    });
    assert(publish.ok(), await publish.text());
    await page.goto(origin);
  } else {
    await page.locator("#site-inspect").check();
    await view()
      .locator(".hero > img")
      .click({ position: { x: 30, y: 30 } });
    await page
      .getByLabel("Banner videosu yükle", { exact: true })
      .setInputFiles(file);
    await page.waitForFunction(
      () =>
        !!JSON.parse(
          localStorage.getItem(
            "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1.design",
          ),
        )?.heroVideo,
    );
    video = await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem(
            "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1.design",
          ),
        ).heroVideo,
    );
    assert(video.src.startsWith("idb:"));
    await page.locator("#site-inspect").uncheck();
  }
  await expect(view().locator(".hero-video")).toBeVisible();
  try {
    await expect
      .poll(
        () =>
          view()
            .locator(".hero-video")
            .evaluate((v) => v.readyState),
        { timeout: 15000 },
      )
      .toBeGreaterThan(1);
  } catch (error) {
    console.error(
      await view()
        .locator(".hero-video")
        .evaluate((v) => ({
          src: v.src,
          current: v.currentSrc,
          network: v.networkState,
          ready: v.readyState,
          error: v.error?.message,
        })),
    );
    if (app) {
      const response = await context.request.get(origin + video.src);
      console.error({
        status: response.status(),
        headers: response.headers(),
        bytes: (await response.body()).length,
        expected: file.buffer.length,
      });
    }
    throw error;
  }
  assert(
    await view()
      .locator(".hero-video")
      .evaluate((v) => v.muted && v.loop && v.playsInline),
  );
  await view()
    .getByRole("button", { name: "Banner videosunu duraklat", exact: true })
    .click();
  assert(
    await view()
      .locator(".hero-video")
      .evaluate((v) => v.paused),
  );
  await view()
    .getByRole("button", { name: "Banner videosunu oynat", exact: true })
    .click();
  await page.reload();
  await expect(view().locator(".hero-video")).toBeVisible();
  if (!app) {
    await page
      .getByRole("button", { name: "Veri paneli", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Taslak & yedek", exact: true })
      .click();
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Taslağı indir ↗", exact: true })
      .first()
      .click();
    const download = await downloadPromise;
    const backupPath = "/tmp/kuzmin-video-backup.json";
    await download.saveAs(backupPath);
    const backup = JSON.parse(readFileSync(backupPath, "utf8"));
    assert.equal(backup.media.src, video.src);
    assert(backup.media.data.length > 10);
    const second = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      restored = await second.newPage();
    restored.on("pageerror", (e) => errors.push(e.message));
    await restored.goto(origin + "/docs/panel.html");
    await restored
      .getByRole("button", { name: "Veri paneli", exact: true })
      .click();
    await restored
      .getByRole("button", { name: "Taslak & yedek", exact: true })
      .click();
    restored.once("dialog", (d) => d.accept());
    await restored.locator("#import-file").setInputFiles(backupPath);
    await restored.getByText("Taslak yüklendi.", { exact: true }).waitFor();
    await restored
      .getByRole("button", { name: "Sayfa önizlemeleri", exact: true })
      .click();
    await expect(
      restored.frameLocator("#site-frame").locator(".hero-video"),
    ).toBeVisible();
    await second.close();
    await page
      .getByRole("button", { name: "Sayfa önizlemeleri", exact: true })
      .click();
    await page.locator("#site-inspect").check();
    await view()
      .locator(".hero-video")
      .click({ position: { x: 30, y: 30 } });
    await page
      .getByRole("button", {
        name: "Videoyu kaldır, fotoğrafı kullan",
        exact: true,
      })
      .click();
    await expect(view().locator(".hero-video")).toHaveCount(0);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  if (app) {
    await expect(view().locator(".hero-video")).toBeVisible();
    assert(
      await view()
        .locator(".hero-video")
        .evaluate((v) => v.paused),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "/tmp/home-curated-mobile.png",
      fullPage: true,
    });
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS (" +
      (app ? "production app" : "browser workspace") +
      "): curated photos, spacing, video upload/play/pause/reload, reduced motion and media backup.",
  );
} finally {
  await browser.close();
  if (app) await server.stop();
  else {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
  if (uploadedPath)
    try {
      unlinkSync(uploadedPath);
    } catch {}
}
