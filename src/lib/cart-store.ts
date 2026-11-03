"use client";
import { useSyncExternalStore } from "react";
import type { CartLine } from "./types";
const empty: CartLine[] = [];
let cache: CartLine[] = empty,
  raw: string | null = null;
const listeners = new Set<() => void>();
function snapshot() {
  if (typeof window === "undefined") return empty;
  const current = localStorage.getItem("kz-cart");
  if (current !== raw) {
    raw = current;
    try {
      const lines = JSON.parse(current || "[]");
      cache = Array.isArray(lines)
        ? lines.filter(
            (l) =>
              typeof l.productId === "string" &&
              typeof l.variantId === "string" &&
              Number.isInteger(l.quantity) &&
              l.quantity > 0 &&
              l.quantity <= 99,
          )
        : empty;
    } catch {
      cache = empty;
    }
  }
  return cache;
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
export function useCart() {
  const cart = useSyncExternalStore(subscribe, snapshot, () => empty);
  function setCart(next: CartLine[] | ((old: CartLine[]) => CartLine[])) {
    cache = typeof next === "function" ? next(snapshot()) : next;
    raw = JSON.stringify(cache);
    localStorage.setItem("kz-cart", raw);
    listeners.forEach((cb) => cb());
  }
  return [cart, setCart] as const;
}
