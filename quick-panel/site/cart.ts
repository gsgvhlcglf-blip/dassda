import { useSyncExternalStore } from "react";
import type { CartLine } from "../../src/lib/types";
let value: CartLine[] = window.__KZ_SITE__.cart || [];
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
    listeners.forEach((fn) => fn());
    window.parent.postMessage({ type: "kz-site-cart", cart: value }, "*");
  }
  return [cart, setCart] as const;
}
