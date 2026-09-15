"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Suggest } from "@/lib/types";
import { money } from "@/lib/format";
import { useClickOutside, useDebounced } from "@/lib/hooks";
import { ImageBox } from "@/components/ui/ImageBox";
import { cn } from "@/lib/cn";

const EMPTY: Suggest = { products: [], categories: [], brands: [] };

export function SearchBox({ compact, initial = "" }: { compact?: boolean; initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Suggest>(EMPTY);
  const debounced = useDebounced(q.trim(), 250);
  const ref = useRef<HTMLFormElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  useEffect(() => {
    const ctrl = new AbortController();
    const q = debounced;
    const run = async () => {
      if (q.length < 2) {
        setData(EMPTY);
        return;
      }
      try {
        const r = await api<Suggest>("/catalog/suggest", { query: { q }, revalidate: false, signal: ctrl.signal });
        if (!ctrl.signal.aborted) setData(r);
      } catch {
        /* aborted or network error */
      }
    };
    void run();
    return () => ctrl.abort();
  }, [debounced]);

  const hasResults = data.products.length + data.categories.length + data.brands.length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  const h = compact ? "h-10" : "h-11";

  return (
    <form ref={ref} onSubmit={submit} role="search" className="relative flex w-full min-w-0">
      <div className={cn("flex w-full min-w-0 overflow-hidden rounded-[6px] border border-line bg-white transition-colors focus-within:border-ink", h)}>
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Код, наименование или бренд"
          aria-label="Поиск по каталогу"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-4 text-base outline-none placeholder:text-muted"
        />
        <button type="submit" className="flex shrink-0 items-center gap-2 bg-ink px-5 text-base font-semibold text-white transition-colors hover:bg-ink-hover">
          <Search className="size-4 md:hidden" />
          <span className="hidden md:inline">Найти</span>
        </button>
      </div>
      {open && debounced.length >= 2 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-[8px] border border-line bg-white shadow-pop animate-fade-in">
          {hasResults ? (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_220px]">
              <ul className="py-2">
                {data.products.map((p) => (
                  <li key={p.slug}>
                    <Link href={`/product/${p.slug}`} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2 hover:bg-surface">
                      <ImageBox src={p.image} alt={p.name} className="size-10 shrink-0" sizes="40px" rounded="rounded-[4px]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base">{p.name}</span>
                        <span className="block text-xs text-sub">Код: {p.code}</span>
                      </span>
                      <span className="shrink-0 text-base font-semibold tnum">{money(p.price)}</span>
                    </Link>
                  </li>
                ))}
                <li>
                  <button type="submit" className="block w-full px-4 py-2.5 text-left text-sm font-medium text-info hover:bg-surface">
                    Все результаты по запросу «{debounced}»
                  </button>
                </li>
              </ul>
              {data.categories.length + data.brands.length > 0 ? (
                <div className="border-t border-line bg-surface-2 p-4 md:border-l md:border-t-0">
                  {data.categories.length > 0 ? (
                    <div className="mb-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sub">Категории</p>
                      <ul className="flex flex-col gap-1.5">
                        {data.categories.map((c) => (
                          <li key={c.slug}>
                            <Link href={`/catalog/${c.slug}`} onClick={() => setOpen(false)} className="text-sm hover:text-brand-hover">
                              {c.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {data.brands.length > 0 ? (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sub">Бренды</p>
                      <ul className="flex flex-col gap-1.5">
                        {data.brands.map((b) => (
                          <li key={b.slug}>
                            <Link href={`/brands/${b.slug}`} onClick={() => setOpen(false)} className="text-sm hover:text-brand-hover">
                              {b.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="px-4 py-3 text-sm text-sub">Ничего не найдено по запросу «{debounced}»</p>
          )}
        </div>
      ) : null}
    </form>
  );
}
