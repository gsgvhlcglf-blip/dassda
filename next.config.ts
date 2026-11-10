import type { NextConfig } from "next";
const config: NextConfig = {
  ...(process.env.DEPLOYMENT_TARGET === "hostinger"
    ? { output: "standalone" as const }
    : {}),
  poweredByHeader: false,
  serverExternalPackages: ["node:sqlite", "nodemailer"],
  images: { formats: ["image/webp"], minimumCacheTTL: 86400 },
  outputFileTracingExcludes: {
    "/*": [
      "./.env*",
      "./.data/**/*",
      "./public/uploads/**/*",
      "./downloads/**/*",
      "./docs/**/*",
      "./artifacts/**/*",
      "./.runtime/**/*",
      "./.git/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/odeme/donus",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
      {
        source: "/:preview(analitik-onizleme|taslak-onizleme)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};
export default config;
