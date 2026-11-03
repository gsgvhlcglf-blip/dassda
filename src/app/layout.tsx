import type { Metadata } from "next";
import "./globals.css";
import { indexingEnabled } from "@/lib/settings";
export const metadata: Metadata = {
  title: { default: "KUZMIN — Karbon. Karakter.", template: "%s | KUZMIN" },
  description:
    "Motosikletinizin karakterini tamamlayan karbon detaylar. Ducati, BMW ve Yamaha için koleksiyonları keşfedin.",
  robots: { index: indexingEnabled, follow: indexingEnabled },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
