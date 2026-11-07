import { test } from "node:test";
import assert from "node:assert/strict";
import { paginateBlog, blogBannerSize, blogImageKey } from "../src/lib/blog";
import { validateDesign } from "../quick-panel/design.mjs";
import type { Content } from "../src/lib/types";

const posts: Content[] = Array.from({ length: 23 }, (_, i) => ({
  id: "post-" + i,
  key: "blog-topic-" + i,
  title: { tr: "Başlık", en: "", ru: "" },
  body: { tr: "İçerik", en: "", ru: "" },
}));
test("blog pages contain ten posts, retain stable order and bound invalid page values", () => {
  const source = [...posts, { ...posts[0], id: "about", key: "about" }];
  const first = paginateBlog(source);
  assert.equal(first.visible.length, 10);
  assert.equal(first.pages, 3);
  const second = paginateBlog(source, "2");
  assert.equal(second.visible.length, 10);
  assert.equal(second.visible[0].id, "post-10");
  assert.equal(paginateBlog(source, "3").visible.length, 3);
  assert.equal(paginateBlog(source, "999").page, 3);
  for (const value of ["-1", "NaN", "Infinity", "0", "2.5"])
    assert.equal(paginateBlog(source, value).page, 1);
  assert.equal(
    new Set(
      [
        ...first.visible,
        ...second.visible,
        ...paginateBlog(source, "3").visible,
      ].map((p) => p.id),
    ).size,
    23,
  );
  assert.equal(paginateBlog([]).visible.length, 0);
  assert.equal(source.length, 24);
});
test("long titles receive wide banners and article-bound covers survive visual backup validation", () => {
  assert.equal(blogBannerSize("Uzun başlık ".repeat(15), 2), "wide");
  const before = {
    texts: { tr: { "ui:blog": "Sahibin başlığı" } },
    images: {
      "home.gallery.four": "data:image/webp;base64,AAAA",
      [blogImageKey("post-1")]: "data:image/webp;base64,BBBB",
    },
  };
  assert.deepEqual(
    validateDesign(JSON.parse(JSON.stringify(before))).images,
    before.images,
  );
});
