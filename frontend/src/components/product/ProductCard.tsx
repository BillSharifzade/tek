import Link from "next/link";
import type { ProductCard as ProductCardT } from "@/lib/types";
import { stockQty } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ImageBox } from "@/components/ui/ImageBox";
import { BadgeList } from "@/components/ui/Badge";
import { Stars } from "@/components/ui/Rating";
import { SplitPrice } from "@/components/ui/Price";
import { IconCheckGreen } from "@/components/icons/figma";
import { FavoriteButton } from "./FavoriteButton";
import { CardBuyRow } from "./CardBuyRow";

export interface ProductCardProps {
  product: ProductCardT;
  className?: string;
  /** horizontal compact row (accessories drawer, search) */
  compact?: boolean;
  priority?: boolean;
}

export function unitShort(unit: string): string {
  return unit === "м" ? "м" : unit || "шт";
}

/** «Цена за метр» / «Цена за шт» */
export function priceLabel(p: ProductCardT): string {
  if (p.price_unit_label) return `Цена ${p.price_unit_label}`;
  return p.unit === "м" ? "Цена за метр" : "Цена за шт";
}

/** Figma «В наличии (100м)»: зелёная галочка 13×13 + Medium 13/17. */
export function StockLine({ product, className }: { product: ProductCardT; className?: string }) {
  if (!product.in_stock) {
    return (
      <span className={cn("flex items-center gap-[4px] text-[13px] font-medium leading-[17px] text-muted", className)}>
        <svg width={13} height={13} viewBox="0 0 13 13" aria-hidden>
          <circle cx="6.5" cy="6.5" r="6.5" fill="#B3B3B3" />
          <path d="M6.5 3.2V6.7L8.6 8" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        </svg>
        Нет в наличии
      </span>
    );
  }
  return (
    <span className={cn("flex items-center gap-[4px] text-[13px] font-medium leading-[17px] text-black", className)}>
      <IconCheckGreen />
      В наличии ({stockQty(product.stock_total)}
      {unitShort(product.unit)})
    </span>
  );
}

/**
 * Карточка товара — 1:1 с компонентом Figma «Товар» (226×483).
 * Позиции строк фиксированы (как в макете), чтобы ряды в сетке совпадали.
 */
export function ProductCard({ product, className, compact, priority }: ProductCardProps) {
  const href = `/product/${product.slug}`;
  const discounted = product.price.price < product.price.list - 0.004;

  if (compact) {
    return (
      <div className={cn("flex gap-3 rounded-[10px] bg-surface p-3", className)}>
        <Link href={href} className="shrink-0">
          <ImageBox src={product.image} alt={product.name} className="size-20" sizes="80px" rounded="rounded-[6px]" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link href={href} className="line-clamp-2 text-[14px] leading-[18px] link-hover">
            {product.name}
          </Link>
          <span className="text-[13px] leading-[15px] text-muted">Код: {product.code}</span>
          <div className="mt-auto">
            <SplitPrice value={product.price.price} big={16} small={12} weight={700} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <article className={cn("group relative h-[483px] w-full xl:w-[226px]", className)}>
      <Link href={href} className="relative block aspect-square w-full xl:size-[226px]" aria-label={product.name}>
        <ImageBox src={product.image} alt={product.name} className="size-full" rounded="rounded-none" priority={priority} sizes="226px" />
      </Link>
      <BadgeList badges={product.badges} className="pointer-events-none absolute left-[4px] top-[4px]" />
      <div className="absolute right-[4px] top-[4px]">
        <FavoriteButton product={product} box={27} glyph={13} />
      </div>

      <div className="absolute left-0 right-0 top-[240px] flex h-[15px] items-start">
        <Stars value={product.rating} size={14} step={16} className="mt-[0.6px]" />
        <span className="ml-[5.8px] text-[13px] leading-[15.2px] text-muted">{product.reviews_count}</span>
        <span className="ml-auto text-[13px] leading-[15.2px] text-muted">{product.code}</span>
      </div>
      <StockLine product={product} className="absolute left-0 top-[264px]" />
      <Link href={href} className="absolute left-0 top-[290px] w-[219px] max-w-full text-[14px] leading-[21px] text-black line-clamp-4 hover:text-black hover:underline">
        {product.name}
      </Link>

      <p className="absolute left-[-1px] top-[391px] text-[13px] leading-[20px] text-muted">{priceLabel(product)}</p>
      {/* Скидка — вариант «Товар» во фрейме «Frame 2» (10829:3929): старая цена Medium 15/10 #666 зачёркнута, новая 20/14 ExtraBold
          #DF3128 через 11px; базовые линии обеих ≈428 (на 3px выше обычной цены — 431) */}
      <div className={cn("absolute left-[-1px] flex items-baseline", discounted ? "top-[411px] gap-[6px] xl:gap-[11px]" : "top-[414px]")}>
        {discounted ? (
          <>
            <SplitPrice value={product.price.list} big={15} small={10} weight={500} strike className="text-sub" />
            <SplitPrice value={product.price.price} className="text-sale" />
          </>
        ) : (
          <SplitPrice value={product.price.price} className="text-black" />
        )}
      </div>
      <CardBuyRow product={product} className="absolute left-0 right-0 top-[451px]" />
    </article>
  );
}
