import { bestsellersKey, bestsellersSchema } from "./bestsellers";
import { z } from "zod";
import { currentModelYear } from "./model-generations";
const id = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().max(12000);
const localized = z.object({ tr: text, en: text, ru: text });
const slug = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9-]+$/);
const asset = z
  .string()
  .max(2000)
  .refine(
    (v) =>
      !v ||
      v.startsWith("/images/") ||
      v.startsWith("/uploads/") ||
      /^https:\/\/[^\s]+$/.test(v),
    "Use a local image or HTTPS URL",
  );
const price = z.number().min(0).max(1e8).multipleOf(0.01),
  stock = z.number().int().min(0).max(1e7),
  year = z.number().int().min(1900).max(2100);
export const schemas = {
  models: z.object({
    id,
    brand_id: z.enum(["ducati", "bmw", "yamaha"]),
    slug,
    name: z.string().min(1).max(100),
    image: asset,
    published: z.boolean().default(true),
  }),
  generations: z
    .object({
      id,
      model_id: id,
      name: z.string().min(1).max(200),
      start_year: year,
      end_year: year,
      ongoing: z.boolean().optional(),
    })
    .transform((r) => (r.ongoing ? { ...r, end_year: currentModelYear() } : r))
    .refine((r) => r.start_year <= r.end_year, "Invalid year range"),
  model_years: z.object({ id, model_id: id, generation_id: id, year }),
  categories: z.object({ id, slug, name: localized }),
  products: z.object({
    id,
    slug,
    sku: z.string().min(1).max(100),
    title: localized,
    description: localized,
    specifications: localized,
    category_id: id,
    material: z.enum(["full_carbon", "hybrid", "forged", "carbon_finish"]),
    price,
    discount_percent: z.number().min(0).max(100).multipleOf(0.01).default(0),
    matte_enabled: z.boolean().default(false),
    stock: stock.default(0),
    featured: z.boolean(),
    published: z.boolean(),
    demo: z.boolean(),
    weight: z.number().positive().nullable(),
    installation: localized,
    video_url: asset,
    viewer_url: asset,
  }),
  variants: z.object({
    id,
    product_id: id,
    name: localized,
    sku: z.string().min(1).max(100),
    price: price.default(0),
    stock: stock.default(0),
    finish: z.enum(["gloss", "matte"]),
  }),
  product_images: z.object({
    id,
    product_id: id,
    url: asset.refine(Boolean),
    alt: localized,
    position: z.number().int().min(0),
  }),
  compatibility: z
    .object({
      id,
      product_id: id,
      model_id: id,
      generation_id: id.nullable(),
      year_from: year,
      year_to: year,
    })
    .refine((r) => r.year_from <= r.year_to, "Invalid year range"),
  content: z
    .object({ id, key: slug, title: localized, body: localized })
    .superRefine((row, ctx) => {
      if (row.key !== bestsellersKey) return;
      try {
        bestsellersSchema.parse(JSON.parse(row.body.tr));
      } catch {
        ctx.addIssue({
          code: "custom",
          message:
            "Vitrin için en fazla 10 farklı ürün, geçerli kadraj ve 3–20 saniye geçiş süresi seçin.",
          path: ["body", "tr"],
        });
      }
    }),
  orders: z.object({
    id,
    status: z.enum([
      "request_pending",
      "reviewing",
      "confirmed",
      "shipped",
      "cancelled",
      "demo_request",
    ]),
  }),
};
export const orderSchema = z.object({
  customer_name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  phone: z.string().trim().min(7).max(30),
  address: z.string().trim().min(10).max(1000),
  note: z.string().max(2000).default(""),
  consent: z.literal(true),
  locale: z.enum(["tr", "en", "ru"]),
  lines: z
    .array(
      z.object({
        productId: id,
        variantId: id,
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(50),
});
