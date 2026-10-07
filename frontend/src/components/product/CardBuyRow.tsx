"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProductCard } from "@/lib/types";
import { useCart } from "@/store/cart";
import { useHydrated } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { packStep, snapQty } from "@/lib/qty";

/**
 * Нижняя строка карточки (Figma «Group 166», 225×32):
 * [−] 32×32 · «1000» Medium 14/12 #666 · [+] 32×32 · кнопка «В корзину» 110×32 #FFCC33 r6.
 * Серый квадрат r6 у «−» и «+» — только при наведении (в макете #F0F2F4, по палитре ТЗ #EEF0F2); при клике в поле число стирается для ручного ввода.
 */
export function CardBuyRow({ product, className }: { product: ProductCard; className?: string }) {
  const hydrated = useHydrated();
  const inCart = useCart((s) => s.cart?.items.some((i) => i.product.id === product.id) ?? false);
  const add = useCart((s) => s.add);
  const step = packStep(product);
  const [qty, setQty] = useState(step);
  /** ручной ввод: пока поле в фокусе — набранный текст (пусто сразу после клика) */
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const disabled = !product.in_stock;

  return (
    <div className={cn("flex h-[32px] items-center", className)}>
      <div className="relative ml-px hidden h-[32px] w-[97px] shrink-0 sm:block">
        <button
          type="button"
          aria-label="Уменьшить количество"
          disabled={disabled || qty <= step}
          onClick={() => setQty((q) => Math.max(step, q - step))}
          className="absolute left-0 top-0 size-[32px] rounded-[6px] text-[16px] font-light leading-[12px] text-sub transition-colors hover:bg-btn hover:text-black disabled:hover:bg-transparent disabled:hover:text-sub"
        >
          –
        </button>
        <input
          aria-label="Количество"
          inputMode="numeric"
          value={draft ?? qty}
          disabled={disabled}
          onFocus={() => setDraft("")}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 5))}
          onBlur={() => {
            const n = Number(draft);
            if (draft && n > 0) setQty(snapQty(n, step));
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="absolute left-[39px] top-[10px] h-[12px] w-[32px] bg-transparent text-center text-[14px] font-medium leading-[12px] text-sub outline-none tnum"
        />
        <button
          type="button"
          aria-label="Увеличить количество"
          disabled={disabled}
          onClick={() => setQty((q) => q + step)}
          className="absolute left-[78px] top-0 size-[32px] rounded-[6px] text-center text-[16px] font-light leading-[12px] text-sub transition-colors hover:bg-btn hover:text-black disabled:hover:bg-transparent disabled:hover:text-sub"
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
              await add(product.id, snapQty(qty, step));
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
