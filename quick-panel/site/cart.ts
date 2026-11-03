import { useSyncExternalStore } from "react";
import type { CartLine } from "../../src/lib/types";
let value: CartLine[] = window.__KZ_SITE__.cart || [];
const customerKey =
  (window.__KZ_SITE__.storageKey || "kuzmin.workspace") + ".customer-cart";
if (window.__KZ_SITE__.standalone) {
  try {
    const saved = JSON.parse(localStorage.getItem(customerKey) || "[]");
    if (Array.isArray(saved))
      value = saved.filter(
        (l) =>
          Number.isInteger(l.quantity) &&
          l.quantity > 0 &&
          l.quantity <= 99 &&
          window.__KZ_SITE__.catalog.variants.some(
            (v) => v.id === l.variantId && v.product_id === l.productId,
          ),
      );
  } catch {
    /* Start with an empty customer cart. */
  }
}
const listeners = new Set<() => void>();
export function useCart() {
  const cart = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => value,
    () => value,
  );
  function setCart(next: CartLine[] | ((old: CartLine[]) => CartLine[])) {
    value = typeof next === "function" ? next(value) : next;
    if (window.__KZ_SITE__.standalone) {
      try {
        localStorage.setItem(customerKey, JSON.stringify(value));
      } catch {
        /* Cart remains usable in this tab. */
      }
    }
    listeners.forEach((fn) => fn());
    window.parent.postMessage({ type: "kz-site-cart", cart: value }, "*");
  }
  return [cart, setCart] as const;
}
