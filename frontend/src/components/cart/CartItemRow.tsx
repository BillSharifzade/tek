"use client";

import Link from "next/link";
import { useState } from "react";
import type { CartItem } from "@/lib/types";
import { money, qty as fmtQty } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Checkbox } from "@/components/ui/Checkbox";
import { ImageBox } from "@/components/ui/ImageBox";
import { CartFavorite, discountPercent } from "./parts";
import { IconInStock, IconTrash } from "./icons";
import { packStep, snapQty } from "@/lib/qty";

export interface CartItemRowProps {
  item: CartItem;
  onQty: (qty: number) => void;
  onSelect: (selected: boolean) => void;
  onRemove: () => void;
  onAccessories?: () => void;
  readOnly?: boolean;
}

/** Степпер строки корзины (Figma: «-  1000000  +», 14/12 Medium #666, без рамок). 106px — ширина колонки под ним. */
function QtyStepper({ value, onChange, max, label, step = 1 }: { value: number; onChange: (v: number) => void; max?: number; label: string; step?: number }) {
  const [text, setText] = useState(String(value));
  const [last, setLast] = useState(value);
  if (last !== value) {
    setLast(value);
    setText(String(value));
  }
  const commit = (raw: string) => {
    const next = snapQty(Math.floor(Number(raw.replace(",", ".").replace(/\s/g, ""))), step);
    setText(String(next));
    if (next !== value) onChange(next);
  };
  return (
    <div className="flex h-[12px] w-[106px] items-center" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => value > step && onChange(value - step)}
        disabled={value <= step}
        aria-label="Уменьшить"
        className="flex h-[24px] w-[18px] shrink-0 items-center justify-center text-sub transition-colors hover:text-black disabled:text-[#C4C4C4]"
      >
        <svg width={7} height={2} viewBox="0 0 7 2" aria-hidden>
          <rect y="0.35" width="7" height="1.3" fill="currentColor" />
        </svg>
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        aria-label={label}
        onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onChange(value + step);
          }
          if (e.key === "ArrowDown" && value > step) {
            e.preventDefault();
            onChange(value - step);
          }
        }}
        className="h-[20px] w-[69px] min-w-0 rounded-[3px] bg-transparent p-0 text-center text-[14px] font-medium leading-[20px] text-sub tnum outline-none transition-colors hover:bg-surface focus:bg-surface"
      />
      <button
        type="button"
        onClick={() => onChange(value + step)}
        disabled={max !== undefined && value >= max}
        aria-label="Увеличить"
        className="flex h-[24px] w-[19px] shrink-0 items-center justify-center text-sub transition-colors hover:text-black disabled:text-[#C4C4C4]"
      >
        <svg width={9} height={9} viewBox="0 0 9 9" aria-hidden>
          <path d="M0 4.5h9M4.5 0v9" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Строка корзины 1:1 с Figma 8641:438 (Group 57 / 111): чекбокс 16, фото 81×81 r5, «Код» + наличие,
 * название, [«Распродажа»], цена за шт (со скидкой — зачёркнутая + зелёная), степпер, сумма строки,
 * «-12%» и зачёркнутая сумма, «Комплектующие» / «Удалить», сердечко 24×24.
 */
export function CartItemRow({ item, onQty, onSelect, onRemove, onAccessories, readOnly }: CartItemRowProps) {
  const p = item.product;
  const discounted = item.price.price < item.price.list - 0.004;
  const pct = discountPercent(item.price.list, item.price.price);
  const sale = p.badges.includes("sale") || item.price.sale;
  const error = item.error ?? (item.qty > item.stock_total && item.stock_total >= 0 ? { code: "insufficient_stock" as const, available: item.stock_total } : null);
  const inStock = item.stock_total > 0;

  return (
    <li className={cn("relative flex border-b border-line pb-[32px] pt-[40px] first:pt-0 last:border-b-0 last:pb-0", !item.selected && !readOnly && "[&_.cart-dim]:opacity-60")}>
      {!readOnly ? <Checkbox box={16} checked={item.selected} onChange={(e) => onSelect(e.target.checked)} aria-label={`Выбрать ${p.name}`} className="ml-[1px] h-[16px] shrink-0 self-start" /> : null}
      <Link href={`/product/${p.slug}`} className={cn("cart-dim shrink-0 transition-opacity", !readOnly && "ml-[13px]")} tabIndex={-1} aria-hidden>
        <ImageBox src={p.image} alt={p.name} className="size-[81px] bg-white" sizes="81px" rounded="rounded-[5px]" />
      </Link>

      <div className="cart-dim relative ml-[16px] min-w-0 flex-1 transition-opacity">
        <div className="mt-[3px] flex flex-wrap items-center gap-y-[6px] pr-[36px] text-[14px] leading-[12px] sm:h-[12px] sm:flex-nowrap">
          <span className="whitespace-nowrap text-sub">Код: {p.code}</span>
          {inStock ? (
            <span className="ml-[12px] flex items-center gap-[5px] whitespace-nowrap text-black">
              <IconInStock className="shrink-0" />
              В наличии ({fmtQty(item.stock_total)} {p.unit})
            </span>
          ) : (
            <span className="ml-[12px] whitespace-nowrap text-sale">Нет в наличии</span>
          )}
        </div>

        <Link href={`/product/${p.slug}`} className="link-hover mt-[10px] block max-w-[660px] pr-[36px] text-[14px] leading-[18px] text-black line-clamp-2">
          {p.name}
        </Link>

        {discounted ? (
          <span className="ml-[1px] mt-[7px] flex h-[19px] w-fit items-center rounded-[3px] bg-sale-bg pl-[7px] pr-[6px] text-[12px] font-semibold leading-[15px] text-sale-text">
            {sale ? "Распродажа" : "Ваша скидка"}
          </span>
        ) : null}

        <div className={cn("grid grid-cols-2 items-center gap-y-[14px] leading-[12px] sm:h-[12px] sm:grid-cols-[minmax(0,1fr)_106px_133px] sm:grid-rows-[12px] sm:gap-y-0", discounted ? "mt-[16px]" : "mt-[14px]")}>
          <p className="col-span-2 text-[14px] leading-[18px] tnum sm:col-span-1 sm:whitespace-nowrap sm:leading-[12px]">
            {discounted ? (
              <>
                <span className="whitespace-nowrap text-muted line-through">
                  {money(item.price.list)} {p.price_unit_label}
                </span>
                <span className="ml-[13px] font-medium text-[#0FB500] sm:whitespace-nowrap">
                  {money(item.price.price)} {p.price_unit_label}
                </span>
              </>
            ) : (
              <span className="text-sub">
                {money(item.price.price)} {p.price_unit_label}
              </span>
            )}
          </p>

          <div className="relative">
            {readOnly ? (
              <span className="block w-[106px] text-center text-[14px] font-medium leading-[12px] text-sub tnum">
                {fmtQty(item.qty)} {p.unit}
              </span>
            ) : (
              <QtyStepper value={item.qty} onChange={onQty} step={packStep(p)} label={`Количество ${p.name}`} />
            )}
            {error ? (
              <span role="alert" className="absolute left-0 top-[19px] w-[106px] whitespace-nowrap text-center text-[12px] leading-[12px] text-sale tnum">
                В наличии ({fmtQty(error.available)}
                {p.unit})
              </span>
            ) : null}
          </div>

          <div className="relative flex flex-col items-end gap-[6px] text-right sm:block">
            {discounted ? (
              <>
                <span className="flex h-[20px] items-center sm:absolute sm:bottom-[43px] sm:right-0 rounded-[3px] bg-[#0FB500] pl-[4px] pr-[5px] text-[12px] font-extrabold leading-[12px] text-white tnum">
                  -{pct}%
                </span>
                <span className="whitespace-nowrap sm:absolute sm:bottom-[22px] sm:right-0 text-[14px] leading-[12px] text-muted line-through tnum">
                  {money(item.price.list * item.qty)}
                </span>
              </>
            ) : null}
            <span className="whitespace-nowrap text-[16px] font-semibold leading-[12px] text-black tnum">{money(item.line_total)}</span>
          </div>
        </div>

        {!readOnly ? (
          <div className="mt-[11px] flex items-center">
            {onAccessories !== undefined ? (
              <button
                type="button"
                onClick={onAccessories}
                className="h-[32px] min-w-[144px] rounded-[5px] bg-btn px-[16px] text-[14px] font-medium leading-[12px] text-g333 transition-colors hover:bg-btn-hover hover:text-black"
              >
                Комплектующие
              </button>
            ) : null}
            <button type="button" onClick={onRemove} className="link-hover ml-[19px] flex items-center gap-[3px] text-[14px] leading-[12px] text-sub">
              <IconTrash className="-mt-[1px] shrink-0" />
              Удалить
            </button>
          </div>
        ) : null}

        <CartFavorite product={p} className="absolute right-0 top-0" />
      </div>
    </li>
  );
}
