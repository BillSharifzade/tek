"use client";

import { create } from "zustand";
import { ApiError } from "@/lib/api";
import { client, rememberCartToken } from "@/lib/client";
import type { Cart } from "@/lib/types";
import { toast } from "./toast";

interface CartState {
  cart: Cart | null;
  loading: boolean;
  loaded: boolean;
  setCart: (c: Cart) => void;
  load: () => Promise<Cart | null>;
  add: (productId: string, qty: number, opts?: { silent?: boolean }) => Promise<Cart | null>;
  update: (itemId: string, patch: { qty?: number; selected?: boolean }) => Promise<Cart | null>;
  remove: (itemId: string) => Promise<Cart | null>;
  removeSelected: () => Promise<Cart | null>;
  selectAll: (selected: boolean) => Promise<Cart | null>;
  applyCoupon: (code: string) => Promise<Cart | null>;
  removeCoupon: () => Promise<Cart | null>;
  clear: () => Promise<Cart | null>;
}

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "insufficient_stock") {
      const available = (e.details as { available?: number } | undefined)?.available;
      return available !== undefined ? `Доступно только ${available} в наличии` : "Недостаточно товара в наличии";
    }
    if (e.code === "coupon_invalid") return "Купон недействителен";
    return e.message;
  }
  return "Ошибка. Попробуйте ещё раз";
}

export const useCart = create<CartState>((set) => {
  const apply = (cart: Cart) => {
    rememberCartToken(cart.cart_token);
    set({ cart, loaded: true, loading: false });
    return cart;
  };
  const run = async (fn: () => Promise<Cart>): Promise<Cart | null> => {
    set({ loading: true });
    try {
      return apply(await fn());
    } catch (e) {
      set({ loading: false });
      toast.error(errorText(e));
      throw e;
    }
  };

  return {
    cart: null,
    loading: false,
    loaded: false,
    setCart: apply,
    load: async () => {
      set({ loading: true });
      try {
        return apply(await client.get<Cart>("/cart"));
      } catch {
        set({ loading: false, loaded: true });
        return null;
      }
    },
    add: async (productId, qty, opts) => {
      const cart = await run(() => client.post<Cart>("/cart/items", { product_id: productId, qty }));
      if (!opts?.silent) toast.success("Добавлено в корзину", { actionLabel: "Перейти в корзину", actionHref: "/cart" });
      return cart;
    },
    update: (itemId, patch) => run(() => client.patch<Cart>(`/cart/items/${itemId}`, patch)),
    remove: (itemId) => run(() => client.delete<Cart>(`/cart/items/${itemId}`)),
    removeSelected: () => run(() => client.post<Cart>("/cart/items/delete-selected")),
    selectAll: (selected) => run(() => client.post<Cart>("/cart/select-all", { selected })),
    applyCoupon: (code) => run(() => client.post<Cart>("/cart/coupon", { code })),
    removeCoupon: () => run(() => client.delete<Cart>("/cart/coupon")),
    clear: () => run(() => client.post<Cart>("/cart/clear")),
  };
});

export const selectCartCount = (s: CartState) => s.cart?.items_count ?? 0;

if (typeof window !== "undefined") {
  window.addEventListener("tek:auth", () => {
    void useCart.getState().load();
  });
}
