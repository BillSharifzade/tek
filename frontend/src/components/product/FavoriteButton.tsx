"use client";

import type { ProductCard } from "@/lib/types";
import { useFavorites } from "@/store/favorites";
import { useHydrated } from "@/lib/hooks";
import { cn } from "@/lib/cn";

/** Контур сердца из Figma («Избранное»), viewBox 23×23. */
const HEART =
  "M11.501 3.50205C13.9773 1.31527 17.8038 1.38786 20.1893 3.73846C22.5738 6.09009 22.656 9.8353 20.4381 12.2782L11.4989 21.0834L2.56186 12.2782C0.343934 9.8353 0.427212 6.08387 2.81064 3.73846C5.19828 1.39097 9.01746 1.31217 11.501 3.50205ZM18.6967 5.20357C17.1154 3.64618 14.5643 3.58293 12.9094 5.04492L11.5021 6.28711L10.0937 5.04596C8.43346 3.58189 5.88769 3.64618 4.30225 5.20564C2.73157 6.75059 2.65251 9.22355 4.09986 10.8576L11.5 18.148L18.9001 10.8587C20.3485 9.22355 20.2694 6.7537 18.6967 5.20357Z";
const HEART_FILLED =
  "M11.501 3.50205C13.9773 1.31527 17.8038 1.38786 20.1893 3.73846C22.5738 6.09009 22.656 9.8353 20.4381 12.2782L11.4989 21.0834L2.56186 12.2782C0.343934 9.8353 0.427212 6.08387 2.81064 3.73846C5.19828 1.39097 9.01746 1.31217 11.501 3.50205Z";

/**
 * Квадратная кнопка «Избранное»: серый #EEF0F2 + чёрный контур; в избранном — #FDE9E8 + красное сердце.
 * box — сторона квадрата (27 в карточке, 31 в блоке цены, 24 в корзине, 45×44 в плавающей шапке товара).
 * tone="sale" — блок цены распродажи (Figma 10725:4552): #FDE9E8 и красный контур сердца и до добавления в избранное.
 */
export function FavoriteButton({
  product,
  className,
  box = 27,
  boxH,
  glyph,
  withLabel,
  tone,
}: {
  product: ProductCard;
  className?: string;
  box?: number;
  boxH?: number;
  glyph?: number;
  withLabel?: boolean;
  tone?: "sale";
}) {
  const hydrated = useHydrated();
  const active = useFavorites((s) => s.ids.includes(product.id));
  const toggle = useFavorites((s) => s.toggle);
  const on = hydrated && active;
  const g = glyph ?? Math.round(box * 0.5);
  const pink = on || tone === "sale";
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
      style={withLabel ? undefined : { width: box, height: boxH ?? box }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-[6px] transition-colors",
        pink ? "bg-[#fde9e8] text-sale hover:bg-[#fbd8d6]" : "bg-btn text-black hover:bg-btn-hover",
        withLabel && "h-[44px] px-[16px] text-[14px] font-medium",
        className,
      )}
    >
      <svg width={g} height={g} viewBox="0 0 23 23" aria-hidden>
        <path d={on ? HEART_FILLED : HEART} fill="currentColor" />
      </svg>
      {withLabel ? <span className="text-black">{on ? "В избранном" : "В избранное"}</span> : null}
    </button>
  );
}
