import type { ManagedOrder } from "./order-management";
export const orderPreviewKey =
  "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1.orders-demo.v1";
export function readOrderPreview(): ManagedOrder[] {
  try {
    const records = JSON.parse(localStorage.getItem(orderPreviewKey) || "[]");
    return Array.isArray(records)
      ? records.filter(
          (record) =>
            record?.demo === true &&
            typeof record.id === "string" &&
            Array.isArray(record.items),
        )
      : [];
  } catch {
    return [];
  }
}
