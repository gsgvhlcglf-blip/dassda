import type { Catalog, Lang } from "./types";
export function validTrackingTemplate(template: string) {
  if (!template || template.length > 2000) return false;
  try {
    const url = new URL(template.replaceAll("{tracking}", "DEMO"));
    const original = new URL(template);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !original.host.includes("{") &&
      !original.host.includes("%7B") &&
      !/[\r\n]/.test(template)
    );
  } catch {
    return false;
  }
}
export function trackingConfiguration(c: Pick<Catalog, "content">, lang: Lang) {
  const row = c.content.find((row) => row.key === "shipping-tracking");
  const template = row?.body.tr.trim() || "";
  return {
    carrier: row?.title[lang] || row?.title.tr || "",
    template,
    ready: validTrackingTemplate(template),
  };
}
export function trackingLink(template: string, number: string) {
  if (
    !validTrackingTemplate(template) ||
    !/^[a-zA-Z0-9-]{3,80}$/.test(number.trim())
  )
    return null;
  return template.replaceAll("{tracking}", encodeURIComponent(number.trim()));
}
