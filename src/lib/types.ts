export type Lang = "tr" | "en" | "ru";
export type Localized = Record<Lang, string>;
export type Row = { id: string; [key: string]: unknown };
export type Brand = Row & { slug: string; name: string; position: number };
export type Model = Row & {
  brand_id: string;
  slug: string;
  name: string;
  image: string;
  published: boolean;
};
export type Generation = Row & {
  model_id: string;
  name: string;
  start_year: number;
  end_year: number;
};
export type ModelYear = Row & {
  model_id: string;
  generation_id: string;
  year: number;
};
export type Product = Row & {
  slug: string;
  sku: string;
  title: Localized;
  description: Localized;
  specifications: Localized;
  category_id: string;
  material: string;
  price: number;
  discount_percent?: number;
  matte_enabled?: boolean;
  stock: number;
  featured: boolean;
  published: boolean;
  demo: boolean;
  weight: number | null;
  installation: Localized;
  video_url: string;
  viewer_url: string;
};
export type Variant = Row & {
  product_id: string;
  name: Localized;
  sku: string;
  price: number;
  stock: number;
  finish: string;
};
export type ProductImage = Row & {
  product_id: string;
  url: string;
  alt: Localized;
  position: number;
};
export type Compatibility = Row & {
  product_id: string;
  model_id: string;
  generation_id: string | null;
  year_from: number;
  year_to: number;
};
export type Category = Row & { slug: string; name: Localized };
export type Content = Row & { key: string; title: Localized; body: Localized };
export type Order = Row & {
  customer_id?: string | null;
  reference: string;
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  note: string;
  status: string;
  total: number;
  currency: string;
  demo: boolean;
  created_at: string;
};
export type OrderItem = Row & {
  order_id: string;
  product_id: string;
  variant_id: string;
  title: string;
  sku: string;
  quantity: number;
  unit_price: number;
};
export type Catalog = {
  brands: Brand[];
  models: Model[];
  generations: Generation[];
  model_years: ModelYear[];
  products: Product[];
  variants: Variant[];
  product_images: ProductImage[];
  compatibility: Compatibility[];
  categories: Category[];
  content: Content[];
};
export type CartLine = {
  productId: string;
  variantId: string;
  quantity: number;
};
export const tableNames = [
  "brands",
  "models",
  "generations",
  "model_years",
  "products",
  "variants",
  "product_images",
  "compatibility",
  "categories",
  "content",
  "orders",
  "order_items",
] as const;
export type Table = (typeof tableNames)[number];
