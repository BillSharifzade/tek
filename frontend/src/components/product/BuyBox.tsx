"use client";

import Link from "next/link";
import type { Product } from "@/lib/types";
import { money, qty as fmtQty, stockQty } from "@/lib/format";
import { cn } from "@/lib/cn";
import { inCity, useCity } from "@/store/city";
import { useAuth } from "@/store/auth";
import { useHydrated } from "@/lib/hooks";
import { Stepper } from "@/components/ui/Stepper";
import { FavoriteButton } from "./FavoriteButton";
import { priceLabel } from "./ProductCard";
import { useBuy } from "./BuyContext";
import { IconCheckCircle, IconClock, IconDelivery, IconFire } from "./icons";

/** «90,00 с.» → «90 с.» (как в макете «выгода 90 с.») */
export function moneyShort(v: number): string {
  return money(v).replace(/,00 с\.$/, " с.");
}

/** Остаток и срок доставки в выбранном городе. */
export function cityStock(product: Product, city: string) {
  const here = product.stock.filter((s) => s.city === city);
  const qty = here.reduce((sum, s) => sum + s.qty, 0);
  const hint = (here.find((s) => s.qty > 0) ?? product.stock.find((s) => s.qty > 0))?.delivery_hint ?? null;
  return { qty, hint };
}

/** Плашка «Бесплатная пуско-наладка и расчет специалиста» (Figma 8612:248): 292×57, #FFEAB5, r10; строки 13px с шагом 17 (базовые линии 24 / 41). */
export function PromoPlaque({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-[57px] rounded-[10px] bg-[#FFEAB5]", className)}>
      <IconFire className="absolute left-[16px] top-[12px]" />
      <p className="absolute left-[62px] top-[11px] text-[13px] leading-[17px] text-g333">
        <span className="block font-bold text-black">Бесплатная пуско-наладка</span>
        <span className="block">и расчет специалиста</span>
      </p>
    </div>
  );
}

/**
 * Блок цены (Figma «Инфа о товаре»): 292 шириной, белая карточка r10 с тенью.
 * Состояния: обычное (8612:219), распродажа (10725:4529 — красная рамка, заголовок и цена),
 * нет в наличии (10725:4590 — прочерк, серые иконки/кнопка), в корзине (10329:332 — жёлтая обводка).
 */
export function BuyBox({ product }: { product: Product }) {
  const hydrated = useHydrated();
  const city = useCity((s) => s.city);
  const user = useAuth((s) => s.user);
  const { qty, setQty, step, busy, addToCart, inCartQty } = useBuy();

  const oos = !product.in_stock;
  const sale = product.price.sale && !oos;
  const discounted = !oos && product.price.price < product.price.list - 0.004;
  const here = cityStock(product, hydrated ? city : "Душанбе");
  const hereCity = hydrated ? city : "Душанбе";
  const max = product.stock_total > 0 ? Math.max(product.stock_total, step) : undefined;
  const showCashback = hydrated && !!user && product.price.cashback > 0;

  return (
    <div
      className={cn(
        "relative rounded-[10px] bg-white px-[22px] pb-[23px]",
        sale ? "pt-[21px] shadow-[inset_0_0_0_1px_#DF3128,0_2px_7px_2px_rgba(0,0,0,0.08)]" : "pt-[20px] shadow-pop",
      )}
    >
      <FavoriteButton product={product} box={31} glyph={15} tone={sale ? "sale" : undefined} className={cn("absolute right-[23px]", sale ? "top-[23px]" : "top-[20px]")} />

      {sale ? <p className="mb-[15px] text-[20px] font-bold leading-[20px] text-sale">Распродажа</p> : null}
      <p className="text-[14px] leading-[15px] text-muted">{priceLabel(product)}</p>
      <p className={cn("mt-[8px] whitespace-nowrap text-[28px] font-bold leading-[28px] tnum", sale ? "text-sale" : "text-black")}>
        {oos ? "–" : money(product.price.price)}
      </p>
      {discounted ? (
        <p className="mt-[7px] flex items-baseline whitespace-nowrap leading-[16px] tnum">
          <span className="text-[16px] text-sub line-through">{money(product.price.list)}</span>
          {product.price.savings > 0 ? <span className="ml-[13px] text-[14px] text-sale">выгода {moneyShort(product.price.savings)}</span> : null}
        </p>
      ) : null}
      {hydrated && user && product.price.discount_pct > 0 && !sale ? (
        <p className="mt-[6px] text-[13px] leading-[15px] text-sub">Ваша скидка {Math.round(product.price.discount_pct)}%</p>
      ) : null}

      <ul className={cn("flex flex-col gap-[9px] text-[14px] leading-[15px] text-g333", discounted ? "mt-[28px]" : "mt-[24px]")}>
        <li className="flex items-start">
          <span className="relative size-[15px] shrink-0">
            {here.qty > 0 ? <IconCheckCircle /> : <IconClock className="absolute left-[-1px] top-[-1px]" />}
          </span>
          <span className="relative top-[-1px] ml-[9px]">
            {inCity(hereCity)}: {stockQty(here.qty)} {product.unit}
          </span>
        </li>
        <li className="flex items-start">
          <IconDelivery className="ml-px shrink-0" />
          <span className="relative top-[-1px] ml-[8px]">Доставка: {oos ? "" : (here.hint ?? "по запросу")}</span>
        </li>
        {showCashback ? (
          <li className="pl-[24px] text-sub">
            Кешбэк: <span className="text-black">{money(Math.round(qty * product.price.cashback * 100) / 100)}</span>
          </li>
        ) : null}
      </ul>

      <Stepper
        variant="figma"
        className="mt-[22px]"
        value={qty}
        onChange={setQty}
        min={step}
        step={step}
        max={max}
        disabled={oos}
        blank={oos}
      />

      {oos ? (
        <button type="button" disabled className="mt-[11px] flex h-[42px] w-full items-center justify-center rounded-[7px] bg-surface text-[14px] font-medium leading-[24px] text-black">
          Нет в наличии
        </button>
      ) : inCartQty > 0 ? (
        <Link
          href="/cart"
          className="mt-[11px] flex h-[42px] w-full items-center justify-center rounded-[7px] text-[15px] font-medium leading-[24px] text-brand shadow-[inset_0_0_0_2px_#FFCC33] transition-colors hover:bg-brand hover:text-black"
          title={`В корзине ${fmtQty(inCartQty)} ${product.unit}`}
        >
          В корзине
        </Link>
      ) : (
        <button
          type="button"
          onClick={addToCart}
          disabled={busy}
          aria-busy={busy}
          className="mt-[11px] flex h-[42px] w-full items-center justify-center rounded-[7px] bg-brand text-[14px] font-medium leading-[24px] text-black transition-colors hover:bg-brand-hover disabled:opacity-70"
        >
          В корзину
        </button>
      )}
    </div>
  );
}
