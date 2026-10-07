"use client";

import { AlertCircle } from "lucide-react";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";

/*
 * Язык ЛК — точно по Figma «Личный кабинет» (9063:200 / 9085:409 / 9085:497 / 9097:650);
 * TT Commons Pro Trial из макета заменён на Roboto того же кегля (как на остальных страницах):
 *  — белые карточки: обводка #E5E5E5, радиус 7, поля 30 слева; заголовок карточки — центр строки в 36px от верха карточки;
 *  — заголовок карточки Bold 20 (в макете 700 20/56); от его нижнего края до содержимого — 21px;
 *  — поля ввода 35px, рамка #E5E5E5, радиус 7, текст 14, плейсхолдер #808080 (hover/focus — серые обводки по ТЗ);
 *  — подписи 15/23 #555, значения 15 #000 (600), кнопка — 34px, r4 (как «СОХРАНИТЬ»).
 */

/** Tailwind classes for account text inputs (Figma «Group 73»: 35px, border #E5E5E5, r7, text at x=13). */
export const fieldCls =
  "h-[35px] rounded-[7px] border-line bg-white px-[12px] pb-[1px] text-[14px] leading-[20px] text-black placeholder:text-muted hover:border-outline focus:border-outline-hover";

/** Button geometry inside the account (Figma «СОХРАНИТЬ» 9085:426: 34px high, r4); colours stay the site variants (ТЗ). */
export const btnCls = "h-[34px] rounded-[4px]";

/** Label tone of the account (Figma: TT Commons 450 15 #555 → Roboto 400 15). */
export const labelCls = "text-[15px] leading-[20px] text-[#555]";

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

/** White account card (Figma «Rectangle 11»: #FFF, border #E5E5E5, r7). */
export function Card({ children, className, as: Tag = "section", id }: { children: React.ReactNode; className?: string; as?: "section" | "div" | "form"; id?: string }) {
  return <Tag id={id} className={cn("rounded-[7px] border border-line bg-white px-[20px] pb-[24px] pt-[22px] sm:px-[30px] sm:pb-[30px] sm:pt-[25px]", className)}>{children}</Tag>;
}

/** Card title (Figma 700 20/56 → Roboto Bold 20/20) with an optional right-hand slot. */
export function CardTitle({ children, right, className, as: Tag = "h2" }: { children: React.ReactNode; right?: React.ReactNode; className?: string; as?: "h2" | "h3" }) {
  if (!right) return <Tag className={cn("text-[20px] font-bold leading-[20px]", className)}>{children}</Tag>;
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2", className)}>
      <Tag className="text-[20px] font-bold leading-[20px]">{children}</Tag>
      {/* правый слот (кнопка 34px) не раздвигает строку заголовка — заголовок остаётся на одной высоте во всех карточках */}
      <div className="flex items-center sm:-my-[7px]">{right}</div>
    </div>
  );
}

export function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-[7px] bg-surface-2 px-6 py-[44px] text-center text-[15px] leading-[20px] text-[#555]", className)}>{children}</div>;
}

/** Text link inside the account (clickable text → #000 on hover, ТЗ). */
export const linkCls = "text-[15px] leading-[20px] text-black underline decoration-line-3 underline-offset-[3px] transition-colors hover:text-black hover:decoration-black";

/** Path relative to the API base for `client`/`downloadFile` (documents come as `/api/v1/...`). */
export function apiPath(url: string): string {
  if (url.startsWith("/api/v1")) return url.slice("/api/v1".length) || "/";
  return url.startsWith("/") ? url : `/${url}`;
}
