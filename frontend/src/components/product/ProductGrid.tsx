import type { ProductCard as ProductCardT } from "@/lib/types";
import { cn } from "@/lib/cn";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ products, cols = 4, className, priorityCount = 0 }: { products: ProductCardT[]; cols?: 4 | 5; className?: string; priorityCount?: number }) {
  return (
    <div className={cn("grid gap-4", cols === 5 ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-5" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-4", className)}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}
