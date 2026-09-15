import Link from "next/link";
import type { ProductCard as ProductCardT } from "@/lib/types";
import { money, qty as fmtQty } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ImageBox } from "@/components/ui/ImageBox";
import { BadgeList } from "@/components/ui/Badge";
import { Stars } from "@/components/ui/Rating";
import { FavoriteButton } from "./FavoriteButton";
import { AddToCartButton } from "./AddToCartButton";

export interface ProductCardProps {
  product: ProductCardT;
  className?: string;
  /** horizontal compact row (accessories drawer, search) */
  compact?: boolean;
  priority?: boolean;
}

export function StockLine({ product, className }: { product: ProductCardT; className?: string }) {
  if (!product.in_stock) return <span className={cn("text-sm text-sale", className)}>Нет в наличии</span>;
  return (
    <span className={cn("text-sm text-success", className)}>
      В наличии ({fmtQty(product.stock_total)}
      {product.unit === "м" ? "м" : "шт"})
    </span>
  );
}

export function ProductCard({ product, className, compact, priority }: ProductCardProps) {
  const href = `/product/${product.slug}`;
  const discountPct = product.price.discount_pct > 0 ? product.price.discount_pct : undefined;

  if (compact) {
    return (
      <div className={cn("flex gap-3 rounded-[8px] border border-line bg-white p-3", className)}>
        <Link href={href} className="shrink-0">
          <ImageBox src={product.image} alt={product.name} className="size-20" sizes="80px" rounded="rounded-[6px]" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link href={href} className="line-clamp-2 text-base font-medium hover:text-brand-hover">
            {product.name}
          </Link>
          <span className="text-xs text-sub">Код: {product.code}</span>
          <div className="mt-auto flex items-center justify-between gap-2">
            <span className="text-base font-semibold tnum">{money(product.price.price)}</span>
            <AddToCartButton product={product} size="sm" full={false} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <article className={cn("group relative flex flex-col rounded-[8px] border border-line bg-white p-4 transition-shadow hover:shadow-card", className)}>
      <Link href={href} className="relative block" aria-label={product.name}>
        <ImageBox src={product.image} alt={product.name} className="aspect-square w-full" priority={priority} />
        <BadgeList badges={product.badges} discountPct={product.price.sale ? undefined : discountPct} className="absolute left-2 top-2" />
      </Link>
      <div className="absolute right-6 top-6">
        <FavoriteButton product={product} size="sm" />
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2 tnum">
          <span className="text-lg font-semibold">{money(product.price.price)}</span>
          {product.price.price < product.price.list - 0.004 ? <span className="text-sm text-muted line-through">{money(product.price.list)}</span> : null}
        </div>
        <Link href={href} className="line-clamp-2 min-h-[40px] text-base font-medium leading-5 hover:text-brand-hover">
          {product.name}
        </Link>
        {product.reviews_count > 0 ? (
          <span className="flex items-center gap-1.5 text-xs text-sub">
            <Stars value={product.rating} size={12} />
            {product.reviews_count}
          </span>
        ) : null}
        <StockLine product={product} />
      </div>
      <div className="mt-3">
        <AddToCartButton product={product} />
      </div>
    </article>
  );
}
