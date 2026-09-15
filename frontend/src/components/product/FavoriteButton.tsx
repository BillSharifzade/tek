"use client";

import { Heart } from "lucide-react";
import type { ProductCard } from "@/lib/types";
import { useFavorites } from "@/store/favorites";
import { useHydrated } from "@/lib/hooks";
import { cn } from "@/lib/cn";

export function FavoriteButton({ product, className, withLabel, size = "md" }: { product: ProductCard; className?: string; withLabel?: boolean; size?: "sm" | "md" }) {
  const hydrated = useHydrated();
  const active = useFavorites((s) => s.ids.includes(product.id));
  const toggle = useFavorites((s) => s.toggle);
  const on = hydrated && active;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggle(product);
      }}
      aria-pressed={on}
      aria-label={on ? "Убрать из избранного" : "В избранное"}
      title={on ? "Убрать из избранного" : "В избранное"}
      className={cn(
        "inline-flex items-center gap-2 rounded-full transition-colors",
        withLabel ? "h-10 px-4 border border-line bg-white text-base hover:border-muted" : size === "sm" ? "size-8 justify-center bg-white/90 hover:bg-white" : "size-9 justify-center bg-white/90 hover:bg-white",
        on ? "text-sale" : "text-sub hover:text-sale",
        className,
      )}
    >
      <Heart className={cn(size === "sm" ? "size-4" : "size-5")} fill={on ? "currentColor" : "none"} strokeWidth={1.75} />
      {withLabel ? <span className="text-ink">{on ? "В избранном" : "В избранное"}</span> : null}
    </button>
  );
}
