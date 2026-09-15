"use client";

import Link from "next/link";
import { Check, ShoppingCart } from "lucide-react";
import { useState } from "react";
import type { ProductCard } from "@/lib/types";
import { useCart } from "@/store/cart";
import { useHydrated } from "@/lib/hooks";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export interface AddToCartButtonProps {
  product: ProductCard;
  qty?: number;
  size?: "sm" | "md" | "lg";
  full?: boolean;
  className?: string;
  /** show "В корзине" state with a link when the product is already in the cart */
  showInCart?: boolean;
}

export function AddToCartButton({ product, qty = 1, size = "md", full = true, className, showInCart = true }: AddToCartButtonProps) {
  const hydrated = useHydrated();
  const inCart = useCart((s) => (s.cart?.items.some((i) => i.product.id === product.id) ?? false));
  const add = useCart((s) => s.add);
  const [busy, setBusy] = useState(false);

  if (!product.in_stock) {
    return (
      <Button variant="secondary" size={size} full={full} disabled className={className}>
        Нет в наличии
      </Button>
    );
  }

  if (showInCart && hydrated && inCart) {
    return (
      <Link
        href="/cart"
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[6px] border border-success/40 bg-success/10 font-semibold text-success transition-colors hover:bg-success/15",
          size === "sm" ? "h-8 px-3 text-sm" : size === "lg" ? "h-12 px-6 text-md" : "h-10 px-5 text-base",
          full && "w-full",
          className,
        )}
      >
        <Check className="size-4" strokeWidth={2.5} />
        В корзине
      </Link>
    );
  }

  return (
    <Button
      size={size}
      full={full}
      loading={busy}
      className={className}
      icon={<ShoppingCart className="size-4" strokeWidth={2} />}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        try {
          await add(product.id, qty);
        } catch {
          /* toast shown by the store */
        } finally {
          setBusy(false);
        }
      }}
    >
      В корзину
    </Button>
  );
}
