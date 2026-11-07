import { test } from "node:test";
import assert from "node:assert/strict";
import { validateHeroVideoFile } from "../src/lib/hero-video";
import { validateDesign } from "../quick-panel/design.mjs";
test("banner video validation rejects forged types and retains safe media references in design backups", async () => {
  const bytes = new Uint8Array(20);
  bytes.set([0x1a, 0x45, 0xdf, 0xa3]);
  assert.equal(
    await validateHeroVideoFile(
      new File([bytes], "test.webm", { type: "video/webm" }),
    ),
    "video/webm",
  );
  await assert.rejects(() =>
    validateHeroVideoFile(new File([bytes], "fake.mp4", { type: "video/mp4" })),
  );
  await assert.rejects(() =>
    validateHeroVideoFile(
      new File(["<html>bad video</html>"], "fake.webm", { type: "video/webm" }),
    ),
  );
  const video = {
    src: "idb:" + crypto.randomUUID(),
    mime: "video/webm",
    name: "Banner.webm",
    size: 20,
  };
  const design = {
    texts: {},
    images: { "home.gallery.four": "data:image/webp;base64,AAAA" },
    heroVideo: video,
  };
  assert.deepEqual(validateDesign(design).heroVideo, video);
  const local = {
    ...video,
    src: "/api/upload-video?file=" + crypto.randomUUID() + ".webm",
  };
  assert.deepEqual(
    validateDesign({ ...design, heroVideo: local }).heroVideo,
    local,
  );
  for (const src of [
    "javascript:alert(1)",
    "data:video/mp4;base64,AAAA",
    "http://example.com/a.mp4",
    "/etc/passwd",
  ])
    assert.throws(() =>
      validateDesign({ ...design, heroVideo: { ...video, src } }),
    );
  assert(!("heroVideo" in validateDesign({ ...design, heroVideo: null })));
});
