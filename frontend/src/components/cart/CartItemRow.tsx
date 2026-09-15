"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import type { CartItem } from "@/lib/types";
import { money, qty as fmtQty } from "@/lib/format";
import { cn } from "@/lib/cn";
import { inCity, useCity } from "@/store/city";
import { useHydrated } from "@/lib/hooks";
import { Checkbox } from "@/components/ui/Checkbox";
import { Stepper } from "@/components/ui/Stepper";
import { ImageBox } from "@/components/ui/ImageBox";

export interface CartItemRowProps {
  item: CartItem;
  onQty: (qty: number) => void;
  onSelect: (selected: boolean) => void;
  onRemove: () => void;
  onAccessories?: () => void;
  readOnly?: boolean;
}

export function CartItemRow({ item, onQty, onSelect, onRemove, onAccessories, readOnly }: CartItemRowProps) {
  const hydrated = useHydrated();
  const city = useCity((s) => s.city);
  const p = item.product;
  const discounted = item.price.price < item.price.list - 0.004;
  const error = item.error ?? (item.qty > item.stock_total && item.stock_total >= 0 ? { code: "insufficient_stock" as const, available: item.stock_total } : null);

  return (
    <li className={cn("flex gap-4 border-b border-line py-5 last:border-b-0", !item.selected && !readOnly && "opacity-70")}>
      {!readOnly ? (
        <div className="pt-1">
          <Checkbox checked={item.selected} onChange={(e) => onSelect(e.target.checked)} aria-label={`Выбрать ${p.name}`} />
        </div>
      ) : null}
      <Link href={`/product/${p.slug}`} className="shrink-0">
        <ImageBox src={p.image} alt={p.name} className="size-20 border border-line sm:size-24" sizes="96px" rounded="rounded-[6px]" />
      </Link>
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-[minmax(0,1fr)_auto_140px]">
        <div className="min-w-0">
          <Link href={`/product/${p.slug}`} className="line-clamp-2 text-base font-medium hover:text-brand-hover">
            {p.name}
          </Link>
          <p className="mt-1 text-xs text-sub">Код: {p.code}</p>
          <p className="mt-1 text-sm">
            <span className={item.stock_total > 0 ? "text-ink" : "text-sale"}>
              {inCity(hydrated ? city : "Душанбе")}: {item.stock_total > 0 ? `${fmtQty(item.stock_total)} ${p.unit}` : "нет в наличии"}
            </span>
            {item.stock_total > 0 ? <span className="text-sub"> · Доставка: сегодня</span> : null}
          </p>
          {!readOnly ? (
            <div className="mt-3 flex items-center gap-4 text-sm">
              {onAccessories ? (
                <button type="button" onClick={onAccessories} className="font-medium text-info hover:underline">
                  Комплектующие
                </button>
              ) : null}
              <button type="button" onClick={onRemove} className="text-sub hover:text-sale">
                Удалить
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-start gap-1.5 md:items-center">
          {readOnly ? (
            <span className="text-base font-medium tnum">
              {fmtQty(item.qty)} {p.unit}
            </span>
          ) : (
            <Stepper value={item.qty} onChange={onQty} min={1} max={item.stock_total > 0 ? item.stock_total : undefined} ariaLabel={`Количество ${p.name}`} />
          )}
          <span className="text-xs text-sub tnum">
            {money(item.price.price)} {p.price_unit_label}
          </span>
        </div>
        <div className="flex flex-col items-start tnum md:items-end">
          <span className="text-lg font-semibold">{money(item.line_total)}</span>
          {discounted ? (
            <>
              <span className="text-xs text-muted line-through">{money(item.price.list * item.qty)}</span>
              <span className="text-xs font-medium text-sale">скидка {Math.round(item.price.discount_pct)}%</span>
            </>
          ) : null}
          {item.line_cashback > 0 ? <span className="mt-1 rounded-[4px] bg-brand-light px-1.5 py-0.5 text-[11px] font-semibold">Кешбэк {money(item.line_cashback)}</span> : null}
        </div>
        {error ? (
          <p className="flex items-center gap-1.5 text-sm text-sale md:col-span-3" role="alert">
            <AlertCircle className="size-4" />
            В наличии только {fmtQty(error.available)} {p.unit}. Уменьшите количество, чтобы оформить заказ.
          </p>
        ) : null}
      </div>
    </li>
  );
}
