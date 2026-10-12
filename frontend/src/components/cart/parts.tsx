"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { FavoriteButton } from "@/components/product/FavoriteButton";
import type { ProductCard } from "@/lib/types";

/** Жёлтая кнопка итога (Figma Group 111: 342×44, r4, Medium 15/24). */
export const bigYellowBtn =
  "flex h-[44px] w-full items-center justify-center rounded-[4px] bg-brand text-[15px] font-medium leading-[24px] text-black transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50";

/** Пунктирная рамка Figma (dash 2/2, #B3BAC7, 1px) поверх блока с заданным радиусом. */
export function DashedFrame({ radius = 7, color = "#B3BAC7", className }: { radius?: number; color?: string; className?: string }) {
  return (
    <svg aria-hidden className={cn("pointer-events-none absolute inset-0 size-full overflow-visible", className)}>
      <rect
        x="0.5"
        y="0.5"
        rx={radius - 0.5}
        ry={radius - 0.5}
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeDasharray="2 2"
        style={{ width: "calc(100% - 1px)", height: "calc(100% - 1px)" }}
      />
    </svg>
  );
}

/** Горизонтальная пунктирная линия 1px (dash 2/2) — разделители секций чекаута. */
export function DashLine({ className, color = "#B3BAC7" }: { className?: string; color?: string }) {
  return (
    <div
      aria-hidden
      className={cn("h-px w-full", className)}
      style={{ backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 2px, transparent 2px 4px)`, backgroundPosition: "-1px 0" }}
    />
  );
}

/** Точечный лидер между подписью и значением (Figma Line 2–5: dash 2/2 #B3BAC7). */
export function Leader({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("h-[2px] min-w-[12px] flex-1 self-end", className)}
      style={{
        // в рендере Figma лидер лежит на полупикселе: две строки #CFD4DC / #E2E6EB, штрих 2/2
        backgroundImage:
          "repeating-linear-gradient(90deg, #CFD4DC 0 2px, transparent 2px 4px), repeating-linear-gradient(90deg, #E2E6EB 0 2px, transparent 2px 4px)",
        backgroundSize: "100% 1px, 100% 1px",
        backgroundPosition: "0 0, 0 1px",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

/**
 * «Чипс» из чекаута (Group 102–105): серый #EEF0F2 r7, высота 56, две строки 14/12 (500 #000 и 400 #333, шаг 18).
 * Выбранный — жёлтый #FFCC33 (вариант 10522:2013).
 */
export function Chip({
  active,
  title,
  sub,
  icon,
  className,
  ...rest
}: { active?: boolean; title: ReactNode; sub?: ReactNode; icon?: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "flex h-[56px] shrink-0 items-center rounded-[7px] pl-[16px] pr-[15px] text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active ? "bg-brand hover:bg-brand-hover" : "bg-btn hover:bg-btn-hover",
        className,
      )}
      {...rest}
    >
      {icon}
      <span className="flex flex-col">
        <span className="whitespace-nowrap text-[14px] font-medium leading-[12px] text-black">{title}</span>
        {sub ? <span className="mt-[6px] whitespace-nowrap text-[14px] leading-[12px] text-g333">{sub}</span> : null}
      </span>
    </button>
  );
}

/**
 * «Избранное» в строке корзины: квадрат 24×24 r6. Доработки R3 — не в избранном такая же, как в остальных местах
 * (серый #EEF0F2 + чёрный контур сердца), в избранном — розовый #FDE9E8 и красное сердце.
 */
export function CartFavorite({ product, className }: { product: ProductCard; className?: string }) {
  return <FavoriteButton product={product} box={24} glyph={13} className={className} />;
}

/** −12% → «−12%» по цене прайса и фактической цене. */
export function discountPercent(list: number, price: number): number {
  if (!(list > 0) || price >= list) return 0;
  return Math.max(1, Math.round((1 - price / list) * 100));
}
