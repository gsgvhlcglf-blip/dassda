import type { MetadataRoute } from "next";
import { indexingEnabled } from "@/lib/settings";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      ...(indexingEnabled
        ? {
            allow: "/",
            disallow: [
              "/admin",
              "/api/",
              "/sepet",
              "/odeme",
              "/giris",
              "/uye-ol",
              "/hesabim",
            ],
          }
        : { disallow: ["/"] }),
    },
    sitemap: indexingEnabled
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/sitemap.xml`
      : undefined,
  };
}
