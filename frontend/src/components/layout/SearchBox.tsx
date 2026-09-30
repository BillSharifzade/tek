"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { useClickOutside, useDebounced, useEscape } from "@/lib/hooks";
import { useCart } from "@/store/cart";
import { ImageBox } from "@/components/ui/ImageBox";

export interface SuggestProduct {
  id: string;
  slug: string;
  name: string;
  code: string;
  image: string | null;
  price: number;
  unit: string;
  in_stock: boolean;
}
export interface SuggestCategory {
  slug: string;
  name: string;
  image: string | null;
}
interface SuggestData {
  products: SuggestProduct[];
  categories: SuggestCategory[];
}

const EMPTY: SuggestData = { products: [], categories: [] };

/** Подсказки поиска по товарам. Как у Петровича, но одной колонкой: 5 товаров, ниже — категории (ТЗ). */
export function useProductSuggest(q: string) {
  const [data, setData] = useState<SuggestData>(EMPTY);
  const debounced = useDebounced(q.trim(), 200);
  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      if (debounced.length < 2) {
        setData(EMPTY);
        return;
      }
      try {
        const r = await api<SuggestData>("/catalog/suggest", { query: { q: debounced }, revalidate: false, signal: ctrl.signal });
        if (!ctrl.signal.aborted) setData({ products: r.products.slice(0, 5), categories: r.categories });
      } catch {
        /* aborted / network */
      }
    };
    void run();
    return () => ctrl.abort();
  }, [debounced]);
  return { data, term: debounced };
}

export function SuggestProductRow({
  p,
  onNavigate,
  action,
}: {
  p: SuggestProduct;
  onNavigate?: () => void;
  /** custom action (cart page uses «Добавить») */
  action?: React.ReactNode;
}) {
  const add = useCart((s) => s.add);
  const [busy, setBusy] = useState(false);
  return (
    <li className="group relative flex gap-[16px] rounded-[6px] px-[12px] py-[10px] transition-colors hover:bg-page">
      <Link href={`/product/${p.slug}`} onClick={onNavigate} className="absolute inset-0" aria-label={p.name} />
      <ImageBox src={p.image} alt="" className="size-[56px] shrink-0 bg-white" sizes="56px" rounded="rounded-[4px]" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-[17px] text-muted">
          Код: <span className="text-g333">{p.code}</span>
        </p>
        <p className="mt-[3px] line-clamp-2 text-[14px] leading-[18px] text-g333">{p.name}</p>
        <div className="mt-[4px] flex items-center justify-between gap-3">
          <span className="text-[16px] font-bold leading-[20px] tnum">{money(p.price)}</span>
          {action ??
            (p.in_stock ? (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await add(p.id, 1);
                  } catch {
                    /* toast from store */
                  } finally {
                    setBusy(false);
                  }
                }}
                className="relative z-[1] h-[28px] rounded-[6px] bg-brand px-[18px] text-[14px] font-medium leading-[15px] opacity-0 transition-[opacity,background-color] hover:bg-brand-hover focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-60"
              >
                В корзину
              </button>
            ) : null)}
        </div>
      </div>
    </li>
  );
}

export function SuggestCategories({ items, onNavigate }: { items: SuggestCategory[]; onNavigate?: () => void }) {
  if (items.length === 0) return null;
  return (
    <div className="border-t border-line px-[12px] pb-[8px] pt-[16px]">
      <p className="mb-[8px] text-[13px] font-bold uppercase leading-[16px] tracking-[1px] text-black">Перейти в категорию:</p>
      <ul>
        {items.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/catalog/${c.slug}`}
              onClick={onNavigate}
              className="flex items-center gap-[16px] rounded-[6px] py-[8px] text-[15px] leading-[20px] text-g333 transition-colors hover:text-black"
            >
              <ImageBox src={c.image} alt="" className="size-[48px] shrink-0 bg-white" sizes="48px" rounded="rounded-[4px]" />
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SearchBox({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const { data, term } = useProductSuggest(q);
  const ref = useRef<HTMLFormElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  useEscape(() => setOpen(false), open);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = q.trim();
    if (!t) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(t)}`);
  };
  const close = () => setOpen(false);
  const show = open && term.length >= 2;

  return (
    <form ref={ref} onSubmit={submit} role="search" className="relative w-full">
      {/* Figma: Rectangle 27 (440×44, 2px #FFCC33, r5) + Rectangle 28 (74×44, #FFCC33, r 0 5 5 0) */}
      <div className="flex h-[44px] w-full">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Код, наименование или бренд"
          aria-label="Поиск по товарам"
          autoComplete="off"
          className="h-full min-w-0 flex-1 rounded-l-[5px] border-2 border-r-0 border-brand bg-white pl-[11px] pr-2 text-[14px] leading-[12px] text-black outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        <button type="submit" className="h-full w-[74px] shrink-0 rounded-r-[5px] bg-brand text-[14px] font-medium leading-[12px] text-black transition-colors hover:bg-brand-hover">
          Найти
        </button>
      </div>
      {show ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[90] max-h-[calc(100vh-140px)] overflow-y-auto rounded-[6px] bg-white p-[8px] shadow-pop animate-fade-in">
          {data.products.length + data.categories.length > 0 ? (
            <>
              {data.products.length > 0 ? (
                <ul className="pb-[8px]">
                  {data.products.map((p) => (
                    <SuggestProductRow key={p.slug} p={p} onNavigate={close} />
                  ))}
                </ul>
              ) : null}
              <SuggestCategories items={data.categories} onNavigate={close} />
            </>
          ) : (
            <p className="px-[12px] py-[10px] text-[14px] leading-[20px] text-sub">Ничего не найдено по запросу «{term}»</p>
          )}
        </div>
      ) : null}
    </form>
  );
}
