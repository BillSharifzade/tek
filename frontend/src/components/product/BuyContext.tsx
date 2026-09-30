"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { useCart } from "@/store/cart";
import { useHydrated } from "@/lib/hooks";

interface BuyState {
  product: Product;
  /** шаг количества = кратность упаковки */
  step: number;
  qty: number;
  setQty: (v: number) => void;
  busy: boolean;
  addToCart: () => Promise<void>;
  /** количество этого товара в корзине (0 — нет) */
  inCartQty: number;
}

const Ctx = createContext<BuyState | null>(null);

/** Общее состояние покупки: блок цены и плавающая шапка товара добавляют одно и то же количество. */
export function BuyProvider({ product, children }: { product: Product; children: React.ReactNode }) {
  const hydrated = useHydrated();
  const add = useCart((s) => s.add);
  const update = useCart((s) => s.update);
  const inCartItem = useCart((s) => s.cart?.items.find((i) => i.product.id === product.id) ?? null);
  const inCartQty = inCartItem?.qty ?? 0;
  const step = product.pack?.qty && product.pack.qty > 0 ? product.pack.qty : 1;
  const [draftQty, setDraftQty] = useState(step);
  // товар уже в корзине — степпер показывает и меняет количество в корзине, а не черновик
  const linked = hydrated && inCartItem !== null;
  const qty = linked ? inCartQty : draftQty;
  const setQty = useCallback(
    (v: number) => {
      if (linked && inCartItem) void update(inCartItem.id, { qty: v }).catch(() => undefined);
      else setDraftQty(v);
    },
    [linked, inCartItem, update],
  );
  const [busy, setBusy] = useState(false);

  const addToCart = useCallback(async () => {
    setBusy(true);
    try {
      await add(product.id, qty);
    } catch {
      /* тост показывает стор */
    } finally {
      setBusy(false);
    }
  }, [add, product.id, qty]);

  const value = useMemo<BuyState>(
    () => ({ product, step, qty, setQty, busy, addToCart, inCartQty: hydrated ? inCartQty : 0 }),
    [product, step, qty, setQty, busy, addToCart, hydrated, inCartQty],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBuy(): BuyState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBuy must be used inside <BuyProvider>");
  return v;
}
