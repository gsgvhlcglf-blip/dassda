import type { Content } from "./types";

export const blogPageSize = 10;
export const blogImageKey = (id: string) => "blog:" + id;
export function blogPageNumber(value: string | null | undefined) {
  return value && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : 1;
}
export function paginateBlog(content: Content[], value?: string | null) {
  const posts = content.filter((row) => row.key.startsWith("blog-"));
  const pages = Math.max(1, Math.ceil(posts.length / blogPageSize));
  const page = Math.min(pages, blogPageNumber(value));
  return {
    posts,
    pages,
    page,
    visible: posts.slice((page - 1) * blogPageSize, page * blogPageSize),
  };
}
export function blogBannerSize(title: string, index: number) {
  if (title.trim().length > 88 || index % 5 === 0) return "wide";
  return title.trim().length > 42 ? "medium" : "compact";
}
