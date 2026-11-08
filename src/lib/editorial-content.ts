import source from "../content/editorial.json";
import type { Catalog, Content } from "./types";
import { bestsellerRecord } from "./bestsellers";
export const editorialVersion = "2026-11-08-editorial-v1";
export const aboutEditorial = source.about;
export const editorialPosts: Content[] = source.posts;
export const cookieNoticeReplacements = [
  {
    from: "Çerez tercih kaydı bu tarayıcıda 180 gün tutulur; süresi dolduğunda yeniden seçim istenir.",
    to: "Çerez bildirimi siteye her yeni girişte ve sayfa yenilendiğinde yeniden açılır. Önceki kabul bu ziyaret için otomatik izin sayılmaz; gerekli olmayan analiz yeni seçim yapılana kadar kapalıdır. Son tercih kaydı senkronizasyon amacıyla bu tarayıcıda en fazla 180 gün tutulabilir.",
  },
  {
    from: "İsteğe bağlı analiz ilk ziyarette kapalıdır.",
    to: "İsteğe bağlı analiz her yeni ziyarette başlangıçta kapalıdır.",
  },
];
export function applyEditorialContent(catalog: Catalog) {
  const next = structuredClone(catalog),
    about = next.content.find((r) => r.key === "about"),
    privacy = next.content.find((r) => r.key === "privacy");
  if (about) about.body = { ...about.body, tr: aboutEditorial.tr };
  if (privacy)
    for (const change of cookieNoticeReplacements)
      privacy.body.tr = privacy.body.tr.replaceAll(change.from, change.to);
  for (const post of editorialPosts)
    if (!next.content.some((row) => row.key === post.key))
      next.content.push(structuredClone(post));
  if (!next.content.some((row) => row.key === "home-bestsellers"))
    next.content.push(
      bestsellerRecord({
        productIds: next.products
          .filter((p) => p.published)
          .slice(0, 3)
          .map((p) => p.id),
        intervalSeconds: 5,
        frames: {},
      }),
    );
  return next;
}
