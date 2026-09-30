"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProductCard } from "@/lib/types";
import { useCart } from "@/store/cart";
import { useHydrated } from "@/lib/hooks";
import { cn } from "@/lib/cn";

/**
 * Нижняя строка карточки (Figma «Group 166», 225×32):
 * [−] 32×32 #F0F2F4 r6 · «1000» Medium 14/12 #666 · «+» Light 16 · кнопка «В корзину» 110×32 #FFCC33 r6.
 */
export function CardBuyRow({ product, className }: { product: ProductCard; className?: string }) {
  const hydrated = useHydrated();
  const inCart = useCart((s) => s.cart?.items.some((i) => i.product.id === product.id) ?? false);
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const disabled = !product.in_stock;

  return (
    <div className={cn("flex h-[32px] items-center", className)}>
      <div className="relative ml-px hidden h-[32px] w-[97px] shrink-0 sm:block">
        <button
          type="button"
          aria-label="Уменьшить количество"
          disabled={disabled || qty <= 1}
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className="absolute left-0 top-0 size-[32px] rounded-[6px] bg-field text-[16px] font-light leading-[12px] text-sub transition-colors hover:bg-btn-hover hover:text-black disabled:hover:bg-field disabled:hover:text-sub"
        >
          –
        </button>
        <input
          aria-label="Количество"
          inputMode="numeric"
          value={qty}
          disabled={disabled}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, ""));
            setQty(Number.isFinite(n) && n > 0 ? Math.min(n, 99999) : 1);
          }}
          className="absolute left-[39px] top-[10px] h-[12px] w-[32px] bg-transparent text-center text-[14px] font-medium leading-[12px] text-sub outline-none tnum"
        />
        <button
          type="button"
          aria-label="Увеличить количество"
          disabled={disabled}
          onClick={() => setQty((q) => q + 1)}
          className="absolute left-[84px] top-0 h-[32px] w-[20px] text-center text-[16px] font-light leading-[12px] text-sub transition-colors hover:text-black"
        >
          +
        </button>
      </div>
      {disabled ? (
        <span className="ml-auto flex h-[32px] w-full items-center justify-center rounded-[6px] bg-btn text-[13px] font-medium leading-[15px] text-sub sm:w-[110px]">Нет в наличии</span>
      ) : hydrated && inCart && !busy ? (
        <Link
          href="/cart"
          className="ml-auto flex h-[32px] w-full items-center justify-center rounded-[6px] bg-btn text-[14px] font-medium leading-[15px] text-black transition-colors hover:bg-btn-hover sm:w-[110px]"
        >
          В корзине
        </Link>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await add(product.id, qty);
            } catch {
              /* toast from the store */
            } finally {
              setBusy(false);
            }
          }}
          className="ml-auto h-[32px] w-full rounded-[6px] bg-brand text-[14px] font-medium leading-[15px] text-black transition-colors hover:bg-brand-hover disabled:opacity-70 sm:w-[110px]"
        >
          В корзину
        </button>
      )}
    </div>
  );
}
