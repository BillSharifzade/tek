import type { ProductCard as ProductCardT } from "@/lib/types";
import { cn } from "@/lib/cn";
import { ProductCard } from "./ProductCard";

/**
 * Сетка карточек 226px. cols=5 — лендинг (шаг 258, зазор 32), cols=4 — каталог (шаг 261, зазор 35; ряды через 82).
 * На ≥xl колонки фиксированные и растягиваются по ширине (justify-between) — как в макете.
 */
export function ProductGrid({ products, cols = 4, className, priorityCount = 0 }: { products: ProductCardT[]; cols?: 4 | 5; className?: string; priorityCount?: number }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:justify-between xl:gap-x-0",
        cols === 5 ? "xl:grid-cols-[repeat(5,226px)] xl:gap-y-[48px]" : "xl:grid-cols-[repeat(4,226px)] xl:gap-y-[82px]",
        className,
      )}
    >
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}
