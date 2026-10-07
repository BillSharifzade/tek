"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProductCard } from "@/lib/types";
import { money, stockQty } from "@/lib/format";
import { useHydrated } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { useCart } from "@/store/cart";
import { ImageBox } from "@/components/ui/ImageBox";
import { BadgeList } from "@/components/ui/Badge";
import { Stars } from "@/components/ui/Rating";
import { FavoriteButton } from "./FavoriteButton";
import { unitShort } from "./ProductCard";
import { packStep, snapQty } from "@/lib/qty";

/** Зелёная галочка 14×14 (Figma «free-icon-check»), без clipPath — безопасна при многократной отрисовке. */
function IconCheck14(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={14} height={14} viewBox="0 0 13 13" fill="none" aria-hidden="true" {...props}>
      <path d="M6.5 13C10.0899 13 13 10.0899 13 6.5C13 2.91015 10.0899 0 6.5 0C2.91015 0 0 2.91015 0 6.5C0 10.0899 2.91015 13 6.5 13Z" fill="#00BA00" />
      <path
        d="M8.40886 4.09575L5.64864 6.85546L4.59112 5.79794C4.41022 5.61731 4.16503 5.51585 3.90938 5.51585C3.65374 5.51585 3.40855 5.61731 3.22764 5.79794C3.04701 5.97884 2.94556 6.22403 2.94556 6.47968C2.94556 6.73532 3.04701 6.98051 3.22764 7.16142L4.90673 8.8405C4.92475 8.86208 4.9438 8.88315 4.96411 8.90347C5.14598 9.0843 5.39204 9.18581 5.64851 9.18581C5.90499 9.18581 6.15104 9.0843 6.33292 8.90347C6.35323 8.88315 6.37227 8.86208 6.3903 8.8405L9.77233 5.45897C9.95296 5.27807 10.0544 5.03288 10.0544 4.77724C10.0544 4.52159 9.95296 4.2764 9.77233 4.0955C9.5914 3.9149 9.34618 3.81349 9.09054 3.81354C8.8349 3.81359 8.58972 3.91509 8.40886 4.09575Z"
        fill="white"
      />
    </svg>
  );
}

/** Серый кружок-часы 14×14 для «Нет в наличии». */
function IconClock14(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" aria-hidden="true" {...props}>
      <circle cx="7" cy="7" r="7" fill="#B3B3B3" />
      <path d="M7 3.5V7.2L9.2 8.6" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Нижняя строка карточки комплектующего (Figma «Group 25», y=389): слева 108×32 количество «−  1  +»
 * (светлые знаки #666 без подложки, центры ≈ x 21 / 53 / 85), справа 108×32 жёлтая «В корзину» Bold 13 — обе вплотную к краям карточки.
 */
function AccessoryBuyRow({ product }: { product: ProductCard }) {
  const hydrated = useHydrated();
  const inCart = useCart((s) => s.cart?.items.some((i) => i.product.id === product.id) ?? false);
  const add = useCart((s) => s.add);
  const step = packStep(product);
  const [qty, setQty] = useState(step);
  /** ручной ввод: при клике в поле число стирается */
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const disabled = !product.in_stock;
  const glyph =
    "flex h-full w-[30%] shrink-0 sm:w-[26px] items-center justify-center text-[14px] font-light leading-[12px] text-sub transition-colors hover:text-black disabled:hover:text-sub";
  const right = "flex h-full w-1/2 items-center justify-center text-[13px] font-bold leading-[12px] transition-colors";

  return (
    <div className="absolute inset-x-0 bottom-0 flex h-[32px]">
      <div className="flex h-full w-1/2 items-center sm:pl-[8px] sm:pr-[10px]" role="group" aria-label="Количество">
        <button type="button" aria-label="Уменьшить количество" disabled={disabled || qty <= step} onClick={() => setQty((q) => Math.max(step, q - step))} className={glyph}>
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
          className="h-full min-w-0 flex-1 bg-transparent text-center text-[14px] font-medium leading-[12px] text-sub outline-none tnum focus-visible:text-black"
        />
        <button type="button" aria-label="Увеличить количество" disabled={disabled} onClick={() => setQty((q) => q + step)} className={glyph}>
          +
        </button>
      </div>
      {disabled ? (
        <span className={cn(right, "bg-btn font-medium text-sub")}>Нет в наличии</span>
      ) : hydrated && inCart && !busy ? (
        <Link href="/cart" className={cn(right, "bg-btn text-black hover:bg-btn-hover")}>
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
              /* тост показывает стор */
            } finally {
              setBusy(false);
            }
          }}
          className={cn(right, "bg-brand text-black hover:bg-brand-hover disabled:opacity-70")}
        >
          В корзину
        </button>
      )}
    </div>
  );
}

/**
 * Компактная карточка комплектующего — Figma 8612:341 «Group 25» (216×421, обводка 1px #E8E8E8/80%, без скругления):
 * фото 180×180 с (18,16) · звёзды + отзывы + код на y=205 · цена Bold 20 (базовая линия 249) · название 13/21 (до 4 строк) на y=262 ·
 * «В наличии (…)» 12/13 #666 на y=362 · количество + «В корзину» 108×32 у нижней кромки (y=389).
 */
export function AccessoryCard({ product, className }: { product: ProductCard; className?: string }) {
  const href = `/product/${product.slug}`;
  const discounted = product.price.price < product.price.list - 0.004;

  return (
    <article className={cn("group relative flex flex-col bg-white px-[10px] pb-[45px] pt-[16px] shadow-[inset_0_0_0_1px_rgba(232,232,232,0.8)] sm:px-[18px]", className)}>
      <Link href={href} className="relative block aspect-square w-full" aria-label={product.name}>
        <ImageBox src={product.image} alt={product.name} className="size-full" rounded="rounded-none" sizes="180px" />
      </Link>
      <BadgeList
        badges={product.badges}
        className="pointer-events-none absolute left-[10px] top-[16px] gap-[3px] sm:left-[18px] [&>span]:h-[19px] [&>span]:px-[7px] [&>span]:pt-[3.5px]"
      />
      <div className="absolute right-[10px] top-[20px] sm:right-[21px]">
        <FavoriteButton product={product} box={23} boxH={17} glyph={12} className="rounded-[4px]" />
      </div>

      <div className="mt-[9px] flex h-[13px] items-center text-[12px] leading-[12px] text-sub">
        <Stars value={product.rating} size={12.9} step={16.2} />
        <span className="ml-[7px] tnum">{product.reviews_count}</span>
        <span className="ml-auto truncate pl-2 tnum">{product.code}</span>
      </div>

      <p className="mt-[14px] flex h-[21px] items-baseline gap-[6px] overflow-hidden whitespace-nowrap">
        <span className={cn("text-[20px] font-bold leading-[21px] tnum", discounted ? "text-sale" : "text-black")}>{money(product.price.price)}</span>
        {discounted ? <span className="text-[12px] leading-[12px] text-muted line-through tnum">{money(product.price.list)}</span> : null}
      </p>
      <Link href={href} className="mt-[9px] line-clamp-4 h-[84px] text-[13px] leading-[21px] text-black hover:underline">
        {product.name}
      </Link>

      {product.in_stock ? (
        <p className="mt-[16px] flex h-[14px] items-center gap-[6px] text-[12px] leading-[13px] text-sub">
          <IconCheck14 className="shrink-0" />
          <span className="truncate">
            В наличии ({stockQty(product.stock_total)}
            {unitShort(product.unit)})
          </span>
        </p>
      ) : (
        <p className="mt-[16px] flex h-[14px] items-center gap-[6px] text-[12px] leading-[13px] text-muted">
          <IconClock14 className="shrink-0" />
          Нет в наличии
        </p>
      )}

      <AccessoryBuyRow product={product} />
    </article>
  );
}
