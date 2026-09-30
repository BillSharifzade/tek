"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useFavorites } from "@/store/favorites";
import { useHydrated } from "@/lib/hooks";
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

const HEART_OUTLINE =
  "M16.8767 7.73293C16.277 7.13317 15.4956 6.80286 14.6767 6.80286C13.8578 6.80286 13.0765 7.13317 12.4767 7.73291L12.0003 8.20936L11.5239 7.73293C10.9241 7.13317 10.1428 6.80286 9.32389 6.80286C8.50497 6.80286 7.72364 7.13317 7.1239 7.73291C6.52413 8.33268 6.19385 9.13009 6.19385 9.97826C6.19385 10.8257 6.5235 11.6223 7.12222 12.2219L12.0003 17.1972L16.8784 12.2219C17.4771 11.6223 17.8068 10.8257 17.8068 9.97826C17.8068 9.13009 17.4765 8.33268 16.8767 7.73293ZM16.2352 11.5821L12.0003 15.9013L7.76545 11.5821C7.33704 11.1537 7.10111 10.5841 7.10111 9.97828C7.10111 9.37246 7.33704 8.80286 7.76545 8.37445C8.19383 7.94605 8.7473 7.71011 9.32389 7.71011C9.90047 7.71011 10.4539 7.94605 10.8823 8.37443L12.0003 9.4924L13.1183 8.37445C13.5467 7.94607 14.1001 7.71014 14.6767 7.71014C15.2533 7.71014 15.8068 7.94607 16.2352 8.37445C16.6636 8.80284 16.8995 9.37244 16.8995 9.97828C16.8995 10.5841 16.6636 11.1537 16.2352 11.5821Z";
const HEART_FILLED =
  "M16.8767 7.73293C16.277 7.13317 15.4956 6.80286 14.6767 6.80286C13.8578 6.80286 13.0765 7.13317 12.4767 7.73291L12.0003 8.20936L11.5239 7.73293C10.9241 7.13317 10.1428 6.80286 9.32389 6.80286C8.50497 6.80286 7.72364 7.13317 7.1239 7.73291C6.52413 8.33268 6.19385 9.13009 6.19385 9.97826C6.19385 10.8257 6.5235 11.6223 7.12222 12.2219L12.0003 17.1972L16.8784 12.2219C17.4771 11.6223 17.8068 10.8257 17.8068 9.97826C17.8068 9.13009 17.4765 8.33268 16.8767 7.73293Z";

/** «Избранное» в строке корзины (Figma 10461:787): розовый квадрат 24×24 r6 #FDE9E8, красное сердце #D13B3E. */
export function CartFavorite({ product, className }: { product: ProductCard; className?: string }) {
  const hydrated = useHydrated();
  const active = useFavorites((s) => s.ids.includes(product.id));
  const toggle = useFavorites((s) => s.toggle);
  const on = hydrated && active;
  return (
    <button
      type="button"
      onClick={() => void toggle(product)}
      aria-pressed={on}
      aria-label={on ? "Убрать из избранного" : "В избранное"}
      title={on ? "Убрать из избранного" : "В избранное"}
      className={cn("flex size-[24px] shrink-0 items-center justify-center rounded-[6px] bg-[#FDE9E8] text-[#D13B3E] transition-colors hover:bg-[#FBD8D6]", className)}
    >
      <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden>
        <path d={on ? HEART_FILLED : HEART_OUTLINE} fill="currentColor" />
      </svg>
    </button>
  );
}

/** −12% → «−12%» по цене прайса и фактической цене. */
export function discountPercent(list: number, price: number): number {
  if (!(list > 0) || price >= list) return 0;
  return Math.max(1, Math.round((1 - price / list) * 100));
}
