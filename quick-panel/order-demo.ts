import { exampleInvoicePDF } from "../src/lib/invoices";
import type { InvoiceMeta } from "../src/lib/email-design";
import { defaultEmailDesign, emailDesignSchema } from "../src/lib/email-design";
import type { Catalog } from "../src/lib/types";
import { salePrice } from "../src/lib/product-commerce";
import { orderPreviewKey, readOrderPreview } from "../src/lib/order-preview";
import {
  dailyOrderCounters,
  formatOrderReference,
  orderReferenceDay,
} from "../src/lib/order-reference";
import {
  shipmentSchema,
  assertShippable,
  type ManagedOrder,
} from "../src/lib/order-management";
import { trackingConfiguration, trackingLink } from "../src/lib/tracking";
import type { OrdersTransport } from "../src/components/order-dashboard";

export function orderDemo(catalog: Catalog): OrdersTransport {
  const save = (records: ManagedOrder[]) => {
    localStorage.setItem(orderPreviewKey, JSON.stringify(records));
    window.dispatchEvent(new Event("kz-orders-demo-changed"));
  };
  const emailKey = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1.email-design.v1";
  const emailLoad = async () => {
    try {
      const saved = JSON.parse(localStorage.getItem(emailKey) || "null");
      if (saved)
        return {
          revision: Number(saved.revision) || 0,
          settings: emailDesignSchema.parse(saved.settings),
          sample: true,
        };
    } catch {
      /* Keep previous valid owner drafts intact. */
    }
    return {
      revision: 0,
      settings: structuredClone(defaultEmailDesign),
      sample: true,
    };
  };
  return {
    invoices: {
      async list(orderId) {
        const order = readOrderPreview().find((o) => o.id === orderId);
        return (
          Array.isArray(order?.demo_invoices) ? order.demo_invoices : []
        ) as InvoiceMeta[];
      },
      async sample(orderId) {
        const orders = readOrderPreview(),
          order = orders.find((o) => o.id === orderId);
        if (!order) throw Error("Örnek sipariş bulunamadı.");
        const previous = (
          Array.isArray(order.demo_invoices) ? order.demo_invoices : []
        ) as InvoiceMeta[];
        const invoice: InvoiceMeta = {
          id: crypto.randomUUID(),
          order_id: orderId,
          version: (previous[0]?.version || 0) + 1,
          file_name: "ORNEK-FATURA-GECERSIZ.pdf",
          size: exampleInvoicePDF().length,
          sha256: "0".repeat(64),
          created_at: new Date().toISOString(),
          demo: true,
        };
        order.demo_invoices = [invoice, ...previous];
        save(orders);
        return invoice;
      },
      async download() {
        return new Blob([exampleInvoicePDF() as Uint8Array<ArrayBuffer>], {
          type: "application/pdf",
        });
      },
    },
    emailDesign: {
      load: emailLoad,
      async save(expected, settings) {
        const current = await emailLoad();
        if (current.revision !== expected)
          throw Error("E-posta taslağı başka sekmede değişti. Yenileyin.");
        const result = {
          revision: expected + 1,
          settings: emailDesignSchema.parse(settings),
          sample: true,
        };
        localStorage.setItem(emailKey, JSON.stringify(result));
        return result;
      },
    },
    async list() {
      return { orders: readOrderPreview(), demo: true };
    },
    async sample() {
      const orders = readOrderPreview(),
        id = crypto.randomUUID(),
        selected = catalog.products
          .filter((product) => product.published)
          .slice(0, 2);
      const items = selected.map((product) => ({
        id: crypto.randomUUID(),
        order_id: id,
        product_id: product.id,
        variant_id:
          catalog.variants.find((variant) => variant.product_id === product.id)
            ?.id || "demo",
        title: product.title.tr,
        sku: product.sku,
        quantity: 1,
        unit_price: salePrice(product),
      }));
      const createdAt = new Date();
      const sequence =
        (dailyOrderCounters(orders).get(orderReferenceDay(createdAt).day) ||
          0) + 1;
      orders.unshift({
        id,
        reference: formatOrderReference(sequence, createdAt),
        customer_name: "Örnek müşteri",
        customer_id: "preview-member",
        email: "ornek@example.test",
        phone: "Örnek cep telefonu",
        address: "Örnek teslimat adresi · Gerçek gönderim yapılmaz.",
        note: "Panel denemesi için örnek sipariş.",
        status: "demo_request",
        total: items.reduce(
          (sum, item) => sum + item.unit_price * item.quantity,
          0,
        ),
        currency: "TRY",
        demo: true,
        created_at: createdAt.toISOString(),
        payment_status: "request_only",
        payment_provider: null,
        fulfillment_version: 0,
        tracking_number: "",
        shipping_carrier: "",
        tracking_url: "",
        shipped_at: null,
        items,
      });
      save(orders);
    },
    async share(id, value) {
      const input = shipmentSchema.parse(value),
        orders = readOrderPreview(),
        order = orders.find((row) => row.id === id);
      if (!order) throw Error("Örnek sipariş bulunamadı.");
      assertShippable(order);
      if (Number(order.fulfillment_version || 0) !== input.expected_version)
        throw Error(
          "Örnek sipariş başka sekmede değişti. Yenileyip tekrar deneyin.",
        );
      const config = trackingConfiguration(catalog, "tr");
      Object.assign(order, {
        tracking_number: input.tracking_number,
        shipping_carrier: input.shipping_carrier || config.carrier,
        tracking_url:
          config.ready &&
          (!input.shipping_carrier ||
            input.shipping_carrier.toLocaleLowerCase("tr") ===
              config.carrier.toLocaleLowerCase("tr"))
            ? trackingLink(config.template, input.tracking_number) || ""
            : "",
        shipped_at: order.shipped_at || new Date().toISOString(),
        status: "shipped",
        fulfillment_version: input.expected_version + 1,
      });
      save(orders);
      return order;
    },
  };
}
