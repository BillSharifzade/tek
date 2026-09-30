"use client";

import { AlertCircle } from "lucide-react";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";

/*
 * Язык ЛК (Figma «Личный кабинет», 9063:200 / 9085:409 / 9085:497 / 9097:650), приведённый к системе остальных страниц:
 *  — белые карточки: обводка #E5E5E5, радиус 10 (как карточки оформления заказа), поля 30 слева / 26 сверху;
 *  — заголовок карточки Roboto 600 20/20 (как «Характеристики» на странице товара);
 *  — поля ввода 36px, рамка #D9DDE4, радиус 5, текст 14 (как в оформлении заказа);
 *  — подписи #666 14/…, значения #000.
 */

/** Tailwind classes for account text inputs (height/border/radius of the checkout fields). */
export const fieldCls =
  "h-[36px] rounded-[5px] border-line-3 bg-white px-[13px] text-[14px] leading-[20px] text-black placeholder:text-muted hover:border-outline focus:border-outline-hover";

export function errorMessage(e: unknown, fallback = "Не удалось загрузить данные"): string {
  if (e instanceof ApiError) return e.message || fallback;
  return fallback;
}

export function ErrorLine({ error, className }: { error: string | null; className?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className={cn("flex items-center gap-2 rounded-[7px] bg-sale-bg px-[14px] py-[10px] text-[14px] leading-[18px] text-sale-text", className)}>
      <AlertCircle className="size-4 shrink-0" aria-hidden />
      {error}
    </p>
  );
}

/** White account card. */
export function Card({ children, className, as: Tag = "section", id }: { children: React.ReactNode; className?: string; as?: "section" | "div" | "form"; id?: string }) {
  return <Tag id={id} className={cn("rounded-[10px] border border-line bg-white px-[20px] pb-[24px] pt-[22px] sm:px-[30px] sm:pb-[30px] sm:pt-[26px]", className)}>{children}</Tag>;
}

/** Card title (Roboto 600 20/20) with an optional right-hand slot. */
export function CardTitle({ children, right, className, as: Tag = "h2" }: { children: React.ReactNode; right?: React.ReactNode; className?: string; as?: "h2" | "h3" }) {
  if (!right) return <Tag className={cn("text-[20px] font-semibold leading-[20px]", className)}>{children}</Tag>;
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2", className)}>
      <Tag className="text-[20px] font-semibold leading-[20px]">{children}</Tag>
      {/* правый слот (кнопка 44px) не раздвигает строку заголовка — заголовок остаётся на одной высоте во всех карточках */}
      <div className="flex items-center sm:-my-[12px]">{right}</div>
    </div>
  );
}

export function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-[10px] bg-surface-2 px-6 py-[44px] text-center text-[14px] leading-[20px] text-sub", className)}>{children}</div>;
}

/** Text link inside the account (clickable text → #000 on hover, ТЗ). */
export const linkCls = "text-[14px] leading-[20px] text-black underline decoration-line-3 underline-offset-[3px] transition-colors hover:text-black hover:decoration-black";

/** Path relative to the API base for `client`/`downloadFile` (documents come as `/api/v1/...`). */
export function apiPath(url: string): string {
  if (url.startsWith("/api/v1")) return url.slice("/api/v1".length) || "/";
  return url.startsWith("/") ? url : `/${url}`;
}
