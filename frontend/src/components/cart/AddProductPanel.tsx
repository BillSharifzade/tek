"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/format";
import { useEscape } from "@/lib/hooks";
import { useCart } from "@/store/cart";
import { toast } from "@/store/toast";
import { ImageBox } from "@/components/ui/ImageBox";
import { useProductSuggest, type SuggestProduct } from "@/components/layout/SearchBox";
import { DashLine, DashedFrame } from "./parts";
import { IconInStock, IconPlus16 } from "./icons";
import { packStep } from "@/lib/qty";

function ResultRow({ p, divider }: { p: SuggestProduct; divider?: boolean }) {
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.cart?.items.find((i) => i.product.id === p.id)?.qty ?? 0);
  const [busy, setBusy] = useState(false);
  const unitLabel = p.unit === "м" ? "за метр" : "за шт";
  return (
    <li className="relative flex items-center gap-[16px] py-[16px]">
      {divider ? <DashLine color="#D9DDE4" className="absolute left-0 top-0" /> : null}
      <Link href={`/product/${p.slug}`} className="shrink-0" tabIndex={-1} aria-hidden>
        <ImageBox src={p.image} alt="" className="size-[64px] bg-white" sizes="64px" rounded="rounded-[5px]" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex h-[12px] items-center text-[14px] leading-[12px]">
          <span className="whitespace-nowrap text-sub">Код: {p.code}</span>
          {p.in_stock ? (
            <span className="ml-[12px] flex items-center gap-[5px] whitespace-nowrap text-black">
              <IconInStock className="shrink-0" />В наличии
            </span>
          ) : (
            <span className="ml-[12px] whitespace-nowrap text-muted">Нет в наличии</span>
          )}
        </div>
        <Link href={`/product/${p.slug}`} className="link-hover mt-[7px] block text-[14px] leading-[18px] text-black line-clamp-2">
          {p.name}
        </Link>
        <p className="mt-[5px] text-[14px] leading-[18px] tnum">
          <span className="text-[16px] font-semibold text-black">{money(p.price)}</span> <span className="text-sub">{unitLabel}</span>
        </p>
      </div>
      {inCart > 0 ? (
        <span className="shrink-0 whitespace-nowrap text-[13px] leading-[17px] text-muted tnum">
          В корзине: {inCart} {p.unit}
        </span>
      ) : null}
      <button
        type="button"
        disabled={!p.in_stock || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await add(p.id, packStep(p), { silent: true });
            toast.success(inCart > 0 ? "Количество в корзине увеличено" : "Товар добавлен в корзину");
          } catch {
            /* тост из стора */
          } finally {
            setBusy(false);
          }
        }}
        className="h-[32px] shrink-0 rounded-[5px] bg-brand px-[20px] text-[14px] font-medium leading-[12px] text-black transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        Добавить
      </button>
    </li>
  );
}

/**
 * «+ Добавить товар» (Figma Group 108: пунктирная рамка 829×50 r7) → поисковик товаров прямо в корзине
 * (ТЗ: «поисковик товаров в корзине», референс Петровича в 10522:1897): поле с «×» и «Закрыть», ниже —
 * найденные товары с кнопкой «Добавить».
 */
export function AddProductPanel() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { data, term } = useProductSuggest(q);
  useEscape(() => setOpen(false), open);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative ml-[2px] flex h-[50px] w-[calc(100%-2px)] items-center justify-center gap-[5px] rounded-[7px] bg-white text-[16px] leading-[12px] text-sub transition-colors hover:bg-surface-2 hover:text-black"
      >
        <DashedFrame radius={7} className="transition-colors group-hover:[&>rect]:stroke-outline-hover" />
        {/* Figma: плюс 16×16 @472,262, текст @493,264 (рамка @244, h50) */}
        <IconPlus16 className="mt-[2px] shrink-0" />
        <span className="mt-[2px]">Добавить товар</span>
      </button>
    );
  }

  return (
    <div className="ml-[2px] rounded-[7px] bg-white px-[20px] pb-[4px] pt-[20px] shadow-card">
      <div className="flex items-center gap-[16px]">
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Код, наименование или бренд"
            aria-label="Найти товар для добавления в корзину"
            autoComplete="off"
            className="block h-[40px] w-full rounded-[5px] border border-line-3 bg-white pb-[2px] pl-[13px] pr-[40px] text-[14px] leading-[20px] text-black outline-none transition-colors placeholder:text-muted hover:border-outline focus:border-outline-hover [&::-webkit-search-cancel-button]:hidden"
          />
          {q ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                inputRef.current?.focus();
              }}
              aria-label="Очистить"
              className="absolute right-[6px] top-1/2 flex size-[28px] -translate-y-1/2 items-center justify-center rounded-[5px] text-sub transition-colors hover:bg-btn hover:text-black"
            >
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>
        <button type="button" onClick={() => setOpen(false)} className="link-hover shrink-0 text-[14px] font-medium leading-[20px] text-g333">
          Закрыть
        </button>
      </div>

      {term.length < 2 ? (
        <p className="py-[16px] text-[14px] leading-[20px] text-muted">Введите код, название или бренд — найденные товары можно сразу добавить в корзину.</p>
      ) : data.products.length === 0 ? (
        <p className="py-[16px] text-[14px] leading-[20px] text-sub">Ничего не найдено по запросу «{term}»</p>
      ) : (
        <ul className="mt-[4px]">
          {data.products.map((p, i) => (
            <ResultRow key={p.id} p={p} divider={i > 0} />
          ))}
        </ul>
      )}
    </div>
  );
}
