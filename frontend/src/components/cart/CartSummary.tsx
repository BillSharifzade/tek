"use client";

import { Tag, X } from "lucide-react";
import { useState } from "react";
import type { Cart } from "@/lib/types";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export interface CartSummaryProps {
  cart: Cart;
  deliveryPrice?: number | null;
  onApplyCoupon?: (code: string) => Promise<unknown>;
  onRemoveCoupon?: () => Promise<unknown>;
  action?: React.ReactNode;
  note?: React.ReactNode;
  className?: string;
}

export function CartSummary({ cart, deliveryPrice, onApplyCoupon, onRemoveCoupon, action, note, className }: CartSummaryProps) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const count = cart.selected_count;
  const delivery = deliveryPrice ?? 0;
  const total = Math.round((cart.total + delivery) * 100) / 100;

  return (
    <div className={cn("rounded-[8px] border border-line bg-white p-6", className)}>
      <dl className="flex flex-col gap-3 text-base tnum">
        <div className="flex justify-between gap-3">
          <dt className="text-sub">Товары ({count})</dt>
          <dd className="font-medium">{money(cart.subtotal_list)}</dd>
        </div>
        {cart.discount_total > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-sub">Скидка</dt>
            <dd className="font-medium text-sale">−{money(cart.discount_total)}</dd>
          </div>
        ) : null}
        {cart.coupon ? (
          <div className="flex justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-sub">
              <Tag className="size-3.5" />
              Купон {cart.coupon.code}
              {onRemoveCoupon ? (
                <button type="button" onClick={() => onRemoveCoupon()} aria-label="Удалить купон" className="text-muted hover:text-sale">
                  <X className="size-3.5" />
                </button>
              ) : null}
            </dt>
            <dd className="font-medium text-sale">−{money(cart.coupon.discount)}</dd>
          </div>
        ) : null}
        {deliveryPrice !== undefined ? (
          <div className="flex justify-between gap-3">
            <dt className="text-sub">Доставка</dt>
            <dd className="font-medium">{deliveryPrice === null ? "—" : deliveryPrice === 0 ? "Бесплатно" : money(deliveryPrice)}</dd>
          </div>
        ) : null}
      </dl>
      <div className="my-4 border-t border-line" />
      <div className="flex items-baseline justify-between gap-3 tnum">
        <span className="text-lg font-semibold">Итого</span>
        <span className="text-2xl font-bold">{money(total)}</span>
      </div>
      {cart.cashback_total > 0 ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[6px] bg-brand-light px-3 py-2 text-sm tnum">
          <span className="font-medium">Кешбэк</span>
          <span className="font-semibold">{money(cart.cashback_total)}</span>
        </div>
      ) : null}

      {onApplyCoupon && !cart.coupon ? (
        <form
          className="mt-5 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!code.trim()) return;
            setBusy(true);
            try {
              await onApplyCoupon(code.trim().toUpperCase());
              setCode("");
            } catch {
              /* toast shown by store */
            } finally {
              setBusy(false);
            }
          }}
        >
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Купон или промокод" aria-label="Купон или промокод" className="uppercase placeholder:normal-case" />
          <Button type="submit" variant="secondary" loading={busy} disabled={!code.trim()}>
            Применить
          </Button>
        </form>
      ) : null}

      {action ? <div className="mt-5">{action}</div> : null}
      {note ? <div className="mt-3 text-xs text-sub">{note}</div> : null}
    </div>
  );
}
