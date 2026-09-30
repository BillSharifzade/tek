"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useClickOutside, useDebounced, useEscape } from "@/lib/hooks";
import { SearchDropdown, searchOptions } from "./SearchDropdown";

export interface SuggestProduct {
  id: string;
  slug: string;
  name: string;
  code: string;
  image: string | null;
  price: number;
  unit: string;
  in_stock: boolean;
  pack_qty?: number | null;
}
export interface SuggestCategory {
  slug: string;
  name: string;
  image: string | null;
}
export interface SuggestBrand {
  slug: string;
  name: string;
  logo?: string | null;
}
export interface SuggestData {
  products: SuggestProduct[];
  categories: SuggestCategory[];
  brands: SuggestBrand[];
}

const EMPTY: SuggestData = { products: [], categories: [], brands: [] };

/**
 * Подсказки поиска (/catalog/suggest): до 5 товаров, до 5 категорий и 3 брендов.
 * `loaded` — ответ пришёл именно для текущего `term` (чтобы не мигать «Ничего не найдено» до ответа).
 */
export function useProductSuggest(q: string) {
  const [state, setState] = useState<{ key: string; data: SuggestData }>({ key: "", data: EMPTY });
  const debounced = useDebounced(q.trim(), 200);
  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      if (debounced.length < 2) {
        setState({ key: debounced, data: EMPTY });
        return;
      }
      try {
        const r = await api<Partial<SuggestData>>("/catalog/suggest", { query: { q: debounced }, revalidate: false, signal: ctrl.signal });
        if (!ctrl.signal.aborted)
          setState({
            key: debounced,
            data: { products: (r.products ?? []).slice(0, 5), categories: (r.categories ?? []).slice(0, 5), brands: (r.brands ?? []).slice(0, 3) },
          });
      } catch {
        /* aborted / network */
      }
    };
    void run();
    return () => ctrl.abort();
  }, [debounced]);
  return { data: state.data, term: debounced, loaded: state.key === debounced };
}

interface Box {
  left: number;
  width: number;
  vw: number;
}

/**
 * Ширина выпадашки: в две колонки — шире поля (референс ≈ 800px), в одну — по ширине поля.
 * Левый край — по полю, правый — не дальше края окна.
 */
function panelWidth({ left, width, vw }: Box, twoCols: boolean): number {
  const want = !twoCols ? width : vw >= 1024 ? 820 : vw >= 768 ? 600 : width;
  return Math.round(Math.max(width, Math.min(want, vw - left - 16)));
}

export function SearchBox({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const uid = useId();
  const listId = `search-list${uid}`;
  const optionId = useCallback((i: number) => `${listId}-o${i}`, [listId]);

  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [box, setBox] = useState<Box | null>(null);
  const { data, term, loaded } = useProductSuggest(q);
  const ref = useRef<HTMLFormElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);
  useClickOutside(ref, close, open);
  useEscape(close, open);

  // переход на другую страницу — закрываем подсказки
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
    setActive(-1);
  }
  // новые подсказки — сбрасываем активный пункт
  const [lastData, setLastData] = useState(data);
  if (lastData !== data) {
    setLastData(data);
    setActive(-1);
  }

  const show = open && term.length >= 2;
  const options = searchOptions(term, data.categories, data.brands, data.products);
  const twoCols = data.products.length > 0 && data.categories.length + data.brands.length > 0;

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setBox({ left: r.left, width: r.width, vw: document.documentElement.clientWidth });
  }, []);
  useEffect(() => {
    if (!show) return;
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [show, measure]);

  // активный пункт всегда в зоне видимости (внутренний скролл выпадашки)
  useEffect(() => {
    if (show && active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  }, [show, active, optionId]);

  const openPanel = () => {
    measure();
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = q.trim();
    if (!t) return;
    close();
    router.push(`/search?q=${encodeURIComponent(t)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const n = options.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!show) {
        openPanel();
        return;
      }
      if (n === 0) return;
      if (e.key === "ArrowDown") setActive((i) => (i + 1 >= n ? 0 : i + 1));
      else setActive((i) => (i <= 0 ? n - 1 : i - 1));
    } else if (e.key === "Enter" && show && active >= 0 && active < n) {
      e.preventDefault();
      const href = options[active].href;
      close();
      router.push(href);
    } else if (e.key === "Tab") {
      close();
    } else if (e.key === "Escape" && show) {
      e.preventDefault(); // не очищать поле type=search
      close();
    }
  };

  return (
    <form ref={ref} onSubmit={submit} role="search" className="relative w-full">
      {/* Figma: Rectangle 27 (440×44, 2px #FFCC33, r5) + Rectangle 28 (74×44, #FFCC33, r 0 5 5 0) */}
      <div className="flex h-[44px] w-full">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            openPanel();
          }}
          onFocus={openPanel}
          onKeyDown={onKeyDown}
          placeholder="Код, наименование или бренд"
          aria-label="Поиск по товарам"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={show}
          aria-controls={show ? listId : undefined}
          aria-activedescendant={show && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          className="h-full min-w-0 flex-1 rounded-l-[5px] border-2 border-r-0 border-brand bg-white pl-[11px] pr-2 text-[14px] leading-[12px] text-black outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        <button type="submit" className="h-full w-[74px] shrink-0 rounded-r-[5px] bg-brand text-[14px] font-medium leading-[12px] text-black transition-colors hover:bg-brand-hover">
          Найти
        </button>
      </div>
      {show ? (
        <SearchDropdown
          id={listId}
          term={term}
          loaded={loaded}
          categories={data.categories}
          brands={data.brands}
          products={data.products}
          active={active}
          optionId={optionId}
          onActive={setActive}
          onNavigate={close}
          style={box ? { width: panelWidth(box, twoCols) } : undefined}
        />
      ) : null}
    </form>
  );
}
