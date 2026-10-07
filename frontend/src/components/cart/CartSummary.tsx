"use client";

import { useState } from "react";
import type { Cart } from "@/lib/types";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Leader } from "./parts";
import { IconCashback } from "./icons";

export interface CartSummaryProps {
  cart: Cart;
  /** undefined — строки «Доставка» нет; null — «при оформлении»; число — прибавляется к итогу */
  deliveryPrice?: number | null;
  onApplyCoupon?: (code: string) => Promise<unknown>;
  onRemoveCoupon?: () => Promise<unknown>;
  action?: React.ReactNode;
  note?: React.ReactNode;
  className?: string;
}

/** Строка итога: 14/25, между строками 7px, точечный лидер (Figma Line 2–4). */
export function SummaryRow({ label, value, green, className }: { label: React.ReactNode; value: React.ReactNode; green?: boolean; className?: string }) {
  return (
    <div className={cn("flex h-[25px] items-baseline text-[14px] leading-[25px] tnum", green ? "text-[#0FB500]" : "text-black", className)}>
      <span className="shrink-0 whitespace-nowrap">{label}</span>
      <Leader className="relative top-[3px] mb-[-4px] ml-[4px] mr-[4px] self-baseline" />
      <span className="shrink-0 whitespace-nowrap">{value}</span>
    </div>
  );
}

function CouponField({ onApply }: { onApply: (code: string) => Promise<unknown> }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    try {
      await onApply(c.toUpperCase());
      setCode("");
    } catch {
      /* тост показывает стор */
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="relative h-[32px]">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Купон или промокод"
        aria-label="Купон или промокод"
        className="block h-full w-full rounded-[7px] border border-line-3 bg-white px-[12px] pt-[2px] text-center text-[13px] uppercase leading-[24px] text-black outline-none transition-colors placeholder:normal-case placeholder:text-[#78797A] hover:border-outline focus:border-outline-hover"
      />
      {code.trim() ? (
        <button
          type="submit"
          disabled={busy}
          className="absolute right-[4px] top-[4px] h-[24px] rounded-[5px] bg-brand px-[10px] text-[13px] font-medium leading-[24px] text-black transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          Применить
        </button>
      ) : null}
    </form>
  );
}

/**
 * Правая колонка корзины (Figma 8641:438, Group «Корзина» @1042,209): купон, Товары / Скидка / Доставка
 * с лидерами, зачёркнутая старая сумма, «Итого» 20/700 с линией #B3BAC7, кнопка, кешбэк #4938F8.
 */
export function CartSummary({ cart, deliveryPrice, onApplyCoupon, onRemoveCoupon, action, note, className }: CartSummaryProps) {
  const count = cart.selected_count ?? (cart.items.some((i) => i.selected !== undefined) ? cart.items.filter((i) => i.selected).length : cart.items.length);
  const delivery = deliveryPrice ?? 0;
  const total = Math.round((cart.total + delivery) * 100) / 100;
  const before = Math.round((cart.subtotal_list + delivery) * 100) / 100;
  const couponDiscount = cart.coupon?.discount ?? 0;

  return (
    <div className={cn("w-full px-[1px]", className)}>
      {onApplyCoupon ? (
        cart.coupon ? (
          <div className="flex h-[32px] items-center justify-center gap-[8px] rounded-[7px] border border-line-3 px-[12px] text-[13px] leading-[24px] text-g333">
            Промокод <b className="font-semibold text-black">{cart.coupon.code}</b> применён
            {onRemoveCoupon ? (
              <button type="button" onClick={() => void onRemoveCoupon()} aria-label="Удалить купон" className="link-hover ml-[2px] text-muted">
                <svg width={10} height={10} viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
          </div>
        ) : (
          <CouponField onApply={onApplyCoupon} />
        )
      ) : null}

      <div className={cn("flex flex-col gap-[7px]", onApplyCoupon ? "mt-[20px]" : "")}>
        <SummaryRow label={`Товары (${count})`} value={money(cart.subtotal_list)} />
        <SummaryRow label="Скидка" value={money(cart.discount_total)} green />
        {cart.coupon ? <SummaryRow label={`Промокод ${cart.coupon.code}`} value={money(couponDiscount)} green /> : null}
        {deliveryPrice !== undefined ? (
          <SummaryRow label="Доставка" value={deliveryPrice === null ? "при оформлении" : deliveryPrice === 0 ? "бесплатно" : money(deliveryPrice)} />
        ) : null}
      </div>

      <p className={cn("mt-[19px] h-[20px] text-right text-[16px] font-medium leading-[20px] text-muted line-through tnum", before <= total + 0.004 && "invisible")}>{money(before)}</p>
      {/* Figma: «Итого» 20/700 — базовая линия @410 (глифы 396–409), линия Line 32 @420 */}
      <div className="-mx-[1px] flex h-[32px] items-start justify-between gap-3 border-b border-outline px-[1px] pt-[2px] text-[20px] font-bold leading-[25px] text-black tnum">
        <span>Итого</span>
        <span className="whitespace-nowrap">{money(total)}</span>
      </div>

      {action ? <div className="mt-[18px]">{action}</div> : null}

      {cart.cashback_total > 0 ? (
        <div className="mt-[14px] flex h-[36px] items-center justify-center gap-[7px] rounded-[4px] bg-[#4938F8] text-[15px] font-semibold leading-[20px] text-white tnum">
          {/* Figma 10512:1816: иконка @+10 от верха плашки (на 1px выше центра), текст по центру */}
          <IconCashback className="mb-[2px] shrink-0" />
          Кешбэк {money(cart.cashback_total)}
        </div>
      ) : null}

      {note ? <div className="mt-[12px] text-[13px] leading-[17px] text-sub">{note}</div> : null}
    </div>
  );
}
