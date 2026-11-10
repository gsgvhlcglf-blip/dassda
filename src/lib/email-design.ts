import { z } from "zod";
import { money } from "./i18n";
import { safeShipmentURL, type ManagedOrder } from "./order-management";

export const emailKinds = [
  "order_confirmed",
  "shipment_shared",
  "invoice_ready",
] as const;
export type EmailKind = (typeof emailKinds)[number];
export const emailKindLabels: Record<EmailKind, string> = {
  order_confirmed: "Sipariş onayı",
  shipment_shared: "Kargo bildirimi",
  invoice_ready: "Fatura e-postası",
};
const text = (max: number) => z.string().trim().max(max);
const address = z.union([z.literal(""), z.email().max(254)]);
const template = z
  .object({
    subject: text(180).min(1),
    heading: text(120).min(1),
    intro: text(1200),
    footer: text(600),
    button: text(60),
  })
  .strict();
export const emailDesignSchema = z
  .object({
    brand: text(60).min(1),
    tagline: text(100),
    senderEmail: address,
    replyTo: address,
    accent: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    templates: z
      .object({
        order_confirmed: template,
        shipment_shared: template,
        invoice_ready: template,
      })
      .strict(),
  })
  .strict();
export type EmailDesign = z.infer<typeof emailDesignSchema>;
export type EmailDesignRecord = {
  revision: number;
  settings: EmailDesign;
  sample?: boolean;
};
export type EmailDesignSource = {
  load(): Promise<EmailDesignRecord>;
  save(expected: number, settings: EmailDesign): Promise<EmailDesignRecord>;
};
export const defaultEmailDesign: EmailDesign = {
  brand: "KUZMIN",
  tagline: "CARBON MOTORCYCLE PARTS",
  senderEmail: "",
  replyTo: "",
  accent: "#a64a3c",
  templates: {
    order_confirmed: {
      subject: "Siparişiniz onaylandı · {siparis_no}",
      heading: "Siparişiniz onaylandı.",
      intro:
        "Ödemeniz başarıyla doğrulandı. Siparişinizin özeti aşağıda; üretim ve gönderim sürecinde sizi bilgilendireceğiz.",
      footer:
        "Sipariş numaranızı saklayın. Destek talebinizde bu numarayı belirtin.",
      button: "",
    },
    shipment_shared: {
      subject: "Siparişiniz kargoya verildi · {siparis_no}",
      heading: "Siparişiniz yola çıktı.",
      intro:
        "Siparişiniz kargoya verildi. Takip numaranızla gönderinizi kontrol edebilirsiniz.",
      footer:
        "Takip hareketleri kargo firmasının sistemi güncellendikçe görünür.",
      button: "Kargomu takip et",
    },
    invoice_ready: {
      subject: "Faturanız hazır · {siparis_no}",
      heading: "Faturanız hazır.",
      intro: "Siparişinize ait faturanızı bu e-postaya PDF olarak ekledik.",
      footer: "Faturanızı ve sipariş numaranızı saklayabilirsiniz.",
      button: "",
    },
  },
};
export type InvoiceMeta = {
  id: string;
  order_id: string;
  version: number;
  file_name: string;
  size: number;
  sha256: string;
  created_at: string;
  demo?: boolean;
};
export type InvoiceUpload = {
  bytes: Buffer;
  fileName: string;
  expected: number;
};
export type InvoiceSource = {
  list(orderId: string): Promise<InvoiceMeta[]>;
  upload?(orderId: string, file: File, expected: number): Promise<InvoiceMeta>;
  sample?(orderId: string): Promise<InvoiceMeta>;
  download(invoice: InvoiceMeta): Promise<Blob>;
};
export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};
export type FrozenEmail = EmailMessage & {
  from: string;
  replyTo?: string;
  invoice?: { id: string; sha256: string; fileName: string };
};
export const escapeEmail = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

/** Plain editable copy only. Mandatory order data and totals cannot be removed by a template. */
export function renderOrderEmail(
  kind: EmailKind,
  o: ManagedOrder,
  design: EmailDesign = defaultEmailDesign,
  invoice?: Pick<InvoiceMeta, "file_name" | "version">,
): EmailMessage {
  const t = design.templates[kind],
    e = escapeEmail;
  const subject = t.subject
    .replaceAll("{siparis_no}", o.reference)
    .replace(/[\r\n]/g, " ");
  const finalSubject = subject.includes(o.reference)
    ? subject
    : `${subject} · ${o.reference}`;
  const heading = `<h1 style="font-size:30px;line-height:1.2;letter-spacing:-1px;font-weight:500;margin:0 0 18px">${e(t.heading)}</h1>`;
  const intro = `<p style="color:#555;line-height:1.75;margin:0 0 24px;white-space:pre-line">${e(t.intro)}</p>`;
  const ref = `<div style="border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:16px 0;margin-bottom:26px;font-size:12px;color:#666">SİPARİŞ NUMARASI <strong style="float:right;color:#171717;font-size:16px">${e(o.reference)}</strong></div>`;
  let body = "",
    lines: string[] = [];
  if (kind === "shipment_shared") {
    const url = safeShipmentURL(o.tracking_url);
    body = `<div style="background:#f5f5f5;padding:22px"><p style="margin:0 0 10px;color:#666">${e(o.shipping_carrier || "Kargo bilgisi")}</p><strong style="font-size:22px;word-break:break-all">${e(o.tracking_number || "Takip numarası paylaşılacak")}</strong></div>`;
    if (url && t.button)
      body += `<p style="margin:24px 0"><a href="${e(url)}" style="background:${e(design.accent)};color:#fff;text-decoration:none;display:inline-block;padding:15px 24px;font-size:13px">${e(t.button)}</a></p>`;
    lines = [
      `Kargo firması: ${o.shipping_carrier || "Henüz belirtilmedi"}`,
      `Takip numarası: ${o.tracking_number || "Henüz paylaşılmadı"}`,
      ...(url ? [`Kargo takibi: ${url}`] : []),
    ];
  } else if (kind === "invoice_ready") {
    body = `<div style="border:1px solid #ddd;padding:22px"><span style="color:${e(design.accent)};font-size:11px;letter-spacing:2px">PDF FATURA</span><p style="margin:10px 0;word-break:break-word">${e(invoice?.file_name || "Örnek fatura.pdf")}</p><small style="color:#666">Faturanız bu e-postanın ekindedir.</small></div>`;
    lines = [
      `PDF fatura: ${invoice?.file_name || "Örnek fatura.pdf"}`,
      "Faturanız bu e-postanın ekindedir.",
    ];
  } else {
    const rows = o.items
      .map(
        (item) =>
          `<tr><td style="padding:17px 5px 17px 0;border-bottom:1px solid #e6e6e6;overflow-wrap:anywhere">${e(item.title)}<br><small style="color:#777">${e(item.sku)}</small></td><td style="padding:17px 5px;text-align:center;border-bottom:1px solid #e6e6e6">${item.quantity}</td><td style="padding:17px 5px;text-align:right;border-bottom:1px solid #e6e6e6">${e(money(item.unit_price, "tr", o.currency))}</td><td style="padding:17px 0 17px 5px;text-align:right;border-bottom:1px solid #e6e6e6">${e(money(item.unit_price * item.quantity, "tr", o.currency))}</td></tr>`,
      )
      .join("");
    body = `<table role="table" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:12px;line-height:1.5"><thead><tr style="color:#777;font-size:10px;text-align:left"><th style="padding-bottom:10px">ÜRÜN</th><th>ADET</th><th style="text-align:right">BİRİM FİYAT</th><th style="text-align:right">TUTAR</th></tr></thead><tbody>${rows}</tbody></table><table width="100%" style="font-size:13px;padding-top:20px"><tr><td>Kargo</td><td style="text-align:right">Ücretsiz</td></tr><tr><td style="padding-top:18px"><strong>Brüt toplam (KDV dahil)</strong></td><td style="padding-top:18px;text-align:right;font-size:20px"><strong>${e(money(o.total, "tr", o.currency))}</strong></td></tr></table><p style="font-size:12px;color:#666;line-height:1.7;margin-top:25px">Özel üretim ürünler 7–15 iş gününde kargoya verilir.</p>`;
    lines = o.items.map(
      (item) =>
        `${item.title} · ${item.sku}\n${item.quantity} adet × ${money(item.unit_price, "tr", o.currency)} = ${money(item.unit_price * item.quantity, "tr", o.currency)}`,
    );
    lines.push(
      "",
      "Kargo: Ücretsiz",
      `Brüt toplam (KDV dahil): ${money(o.total, "tr", o.currency)}`,
      "Özel üretim ürünler 7–15 iş gününde kargoya verilir.",
    );
  }
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(finalSubject)}</title></head><body style="margin:0;padding:24px 10px;background:#ededed;font-family:Arial,Helvetica,sans-serif;color:#171717"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;background:#fff"><tr><td style="background:#0a0a0a;color:#fff;padding:32px"><div style="font-size:28px;letter-spacing:-1px">${e(design.brand)}</div><div style="font-size:8px;letter-spacing:2px;margin-top:7px;color:#ccc">${e(design.tagline)}</div></td></tr><tr><td style="padding:32px 24px">${heading}<p style="font-size:13px;margin:0 0 12px">Merhaba ${e(o.customer_name)},</p>${intro}${ref}${body}<p style="font-size:12px;line-height:1.8;color:#777;white-space:pre-line;margin:32px 0 0">${e(t.footer)}</p></td></tr><tr><td style="border-top:1px solid #eee;padding:20px 24px;font-size:10px;color:#888">${e(design.brand)} · ${e(o.reference)}</td></tr></table></td></tr></table></body></html>`;
  return {
    to: o.email,
    subject: finalSubject,
    text: [
      t.heading,
      `Merhaba ${o.customer_name},`,
      t.intro,
      `Sipariş numarası: ${o.reference}`,
      "",
      ...lines,
      "",
      t.footer,
      design.brand,
    ].join("\n"),
    html,
  };
}

export function emailExampleOrder(): ManagedOrder {
  return {
    id: "email-demo",
    reference: "#1011261",
    customer_name: "Örnek müşteri",
    email: "ornek@example.test",
    phone: "",
    address: "Örnek adres",
    note: "",
    status: "shipped",
    total: 3750,
    currency: "TRY",
    demo: true,
    created_at: new Date().toISOString(),
    payment_status: "paid",
    tracking_number: "ORNEK-123456",
    shipping_carrier: "Örnek kargo firması",
    tracking_url: "https://example.test/takip/ORNEK-123456",
    shipped_at: new Date().toISOString(),
    fulfillment_version: 1,
    items: [
      {
        id: "example-1",
        order_id: "email-demo",
        product_id: "example-1",
        variant_id: "example-1",
        title: "Örnek karbon parça · Parlak vernik",
        sku: "ORNEK-001-G",
        quantity: 2,
        unit_price: 1500,
      },
      {
        id: "example-2",
        order_id: "email-demo",
        product_id: "example-2",
        variant_id: "example-2",
        title: "Örnek karbon aksesuar · Parlak vernik",
        sku: "ORNEK-002-G",
        quantity: 1,
        unit_price: 750,
      },
    ],
  };
}
