import type { Catalog, Localized } from "./types";
const l = (tr: string, en: string, ru: string): Localized => ({ tr, en, ru });
const brands = [
  { id: "ducati", slug: "ducati", name: "DUCATI", position: 1 },
  { id: "bmw", slug: "bmw", name: "BMW", position: 2 },
  { id: "yamaha", slug: "yamaha", name: "YAMAHA", position: 3 },
];
const modelNames: Record<string, string[]> = {
  ducati: ["Diavel 1200", "Diavel V4", "Panigale V4", "Monster"],
  bmw: ["S1000RR", "S1000R", "M1000RR", "R1250GS"],
  yamaha: ["MT-25", "MT-07", "MT-09", "YZF-R1"],
};
const models = brands.flatMap((b) =>
  modelNames[b.id].map((name) => ({
    id: `${b.id}-${name.toLowerCase().replaceAll(" ", "-")}`,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    name,
    brand_id: b.id,
    image: "/images/model.svg",
  })),
);
const generations = models.map((m) => ({
  id: `${m.id}-demo`,
  model_id: m.id,
  name: "Demo generation / gerçek uyumluluk doğrulanmamıştır",
  start_year: 2022,
  end_year: 2026,
}));
const model_years = generations.flatMap((g) =>
  Array.from({ length: 5 }, (_, i) => ({
    id: `${g.model_id}-${2022 + i}`,
    model_id: g.model_id,
    generation_id: g.id,
    year: 2022 + i,
  })),
);
const categories = [
  {
    id: "body",
    slug: "govde",
    name: l("Gövde & Kaporta", "Bodywork", "Обтекатели"),
  },
  {
    id: "protection",
    slug: "koruma",
    name: l("Koruma", "Protection", "Защита"),
  },
  {
    id: "details",
    slug: "detaylar",
    name: l("İnce Detaylar", "Finishing touches", "Детали"),
  },
];
const names = [
  l("Karbon ön çamurluk", "Carbon front fender", "Карбоновое переднее крыло"),
  l("Karbon depo kaplaması", "Carbon tank cover", "Карбоновая накладка бака"),
  l(
    "Karbon egzoz koruması",
    "Carbon exhaust shield",
    "Карбоновая защита выхлопа",
  ),
  l("Karbon arka çamurluk", "Carbon rear hugger", "Карбоновое заднее крыло"),
  l(
    "Karbon yan panel seti",
    "Carbon side panel set",
    "Карбоновые боковые панели",
  ),
  l("Karbon zincir koruması", "Carbon chain guard", "Карбоновая защита цепи"),
];
const products = names.map((title, i) => ({
  id: `p${i + 1}`,
  slug: [
    "karbon-on-camurluk",
    "karbon-depo-kaplamasi",
    "karbon-egzoz-korumasi",
    "karbon-arka-camurluk",
    "karbon-yan-panel",
    "karbon-zincir-korumasi",
  ][i],
  sku: `DEMO-KZ-00${i + 1}`,
  title,
  description: l(
    "Tasarımın her çizgisini tamamlayan yalın bir dokunuş. Bu ürün yalnızca mağaza deneyimini göstermek için hazırlanmış örnek içeriktir. Gerçek ürün, teknik özellik ve uyumluluk bilgileri henüz sağlanmadı.",
    "A considered finishing touch. This is demonstration content only. Real product details, specifications and fitment have not been supplied.",
    "Продуманная деталь. Только демонстрационный товар. Реальные характеристики и совместимость пока не предоставлены.",
  ),
  specifications: l(
    "Örnek malzeme ve yüzey seçenekleri. Teknik doğrulama gereklidir.",
    "Example material and finish options. Technical verification required.",
    "Пример материалов и покрытий. Требуется техническая проверка.",
  ),
  category_id: categories[i % 3].id,
  material: ["full_carbon", "hybrid", "forged"][i % 3],
  price: [6850, 12400, 3250, 7950, 14800, 2850][i],
  stock: 12,
  featured: i < 4,
  published: true,
  demo: true,
  weight: null,
  installation: l(
    "Montaj talimatları gerçek ürünle birlikte eklenecektir.",
    "Installation instructions will be added with real products.",
    "Инструкция будет добавлена с реальными товарами.",
  ),
  video_url: "",
  viewer_url: "",
}));
const variants = products.flatMap((p) =>
  ["gloss", "matte"].map((finish, i) => ({
    id: `${p.id}-${finish}`,
    product_id: p.id,
    name:
      i === 0 ? l("Parlak", "Gloss", "Глянец") : l("Mat", "Matte", "Матовый"),
    sku: `${p.sku}-${i === 0 ? "G" : "M"}`,
    price: p.price,
    stock: 6,
    finish,
  })),
);
const product_images = products.map((p, i) => ({
  id: `img-${p.id}`,
  product_id: p.id,
  url: `/images/part-${i % 3}.svg`,
  alt: p.title,
  position: 0,
}));
const compatibility = products.flatMap((p, i) =>
  models
    .filter((_, j) => j % 3 === i % 3 || j === 8)
    .map((m) => ({
      id: `${p.id}-${m.id}`,
      product_id: p.id,
      model_id: m.id,
      generation_id: `${m.id}-demo`,
      year_from: 2022,
      year_to: 2026,
    })),
);
const content = [
  {
    id: "home",
    key: "home",
    title: l(
      "Detayda fark yarat.",
      "Defined by detail.",
      "Совершенство в деталях.",
    ),
    body: l(
      "Motosikletinin karakterini tamamlayan karbon parçalar. Sade tasarım. Güçlü bir ifade.",
      "Carbon details that complement the character of your motorcycle. Considered design. A distinct expression.",
      "Карбоновые детали, дополняющие характер вашего мотоцикла. Лаконичный дизайн. Яркое выражение.",
    ),
  },
  ...["about", "contact", "faq", "shipping", "privacy", "terms"].map((key) => ({
    id: key,
    key,
    title: {
      about: l("Hakkımızda", "About us", "О нас"),
      contact: l("Birlikte konuşalım.", "Let’s talk.", "Давайте поговорим."),
      faq: l(
        "Sık sorulan sorular",
        "Frequently asked questions",
        "Частые вопросы",
      ),
      shipping: l(
        "Teslimat & İade",
        "Shipping & returns",
        "Доставка и возврат",
      ),
      privacy: l("Gizlilik politikası", "Privacy policy", "Конфиденциальность"),
      terms: l(
        "Kullanım koşulları",
        "Terms & conditions",
        "Условия использования",
      ),
    }[key]!,
    body: l(
      "Bu sayfa yayın öncesi işletme sahibi tarafından doldurulmalıdır. İşletme kimliği, iletişim, teslimat, iade ve yasal koşullar henüz sağlanmadı. Bu mağaza şu anda bir demo deneyimidir.",
      "The business owner must complete this page before launch. Business identity, contact details, shipping, returns and legal terms have not been provided. This store is currently a demonstration.",
      "Владелец должен заполнить страницу перед запуском. Реквизиты, контакты, условия доставки, возврата и юридические документы пока не предоставлены. Магазин работает в демонстрационном режиме.",
    ),
  })),
];
export const seed: Catalog = {
  brands,
  models,
  generations,
  model_years,
  products,
  variants,
  product_images,
  compatibility,
  categories,
  content,
};
