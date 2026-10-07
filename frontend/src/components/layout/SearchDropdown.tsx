"use client";

import Link from "next/link";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { brandLogo } from "@/components/content/brands";
import { ImageBox } from "@/components/ui/ImageBox";
import type { SuggestBrand, SuggestCategory, SuggestProduct } from "./SearchBox";

// Выпадающие подсказки поиска — по референсу из «Прочие дополнительные элементы» (10522:1897, 30.09):
// слева «Перейти в категорию» (серые плашки r10 с картинкой и шевроном), справа «Товары» + «Смотреть все →».
// Чипсы запросов и текстовые подсказки из референса намеренно не делаем (перечёркнуты дизайнером).

/** Пункт списка для клавиатурной навигации (порядок: категории → бренды → товары → «Смотреть все»). */
export interface SearchOption {
  key: string;
  href: string;
}

function IconGoTo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" aria-hidden="true" {...props}>
      <path d="M6 1.75H2.75a1 1 0 0 0-1 1v8.5a1 1 0 0 0 1 1h8.5a1 1 0 0 0 1-1V8" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
      <path d="M8.25 1.75h4v4M12.1 1.9 6.5 7.5" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconRowChevron(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={7} height={12} viewBox="0 0 7 12" fill="none" aria-hidden="true" {...props}>
      <path d="m1 1 5 5-5 5" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconArrowRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={14} height={10} viewBox="0 0 14 10" fill="none" aria-hidden="true" {...props}>
      <path d="M1 5h11.5M8.75 1.25 12.5 5 8.75 8.75" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const label = "flex items-center gap-[6px] text-[14px] leading-[18px] text-muted";

export function SearchDropdown({
  id,
  term,
  loaded,
  categories,
  brands,
  products,
  active,
  optionId,
  onActive,
  onNavigate,
  style,
}: {
  id: string;
  term: string;
  loaded: boolean;
  categories: SuggestCategory[];
  brands: SuggestBrand[];
  products: SuggestProduct[];
  /** индекс активного пункта (−1 — нет) */
  active: number;
  optionId: (i: number) => string;
  onActive: (i: number) => void;
  onNavigate: () => void;
  style?: React.CSSProperties;
}) {
  const left = categories.length + brands.length > 0;
  const right = products.length > 0;
  const allHref = `/search?q=${encodeURIComponent(term)}`;
  // сквозная нумерация пунктов — совпадает с порядком options в SearchBox
  const catBase = 0;
  const brandBase = categories.length;
  const prodBase = brandBase + brands.length;
  const allIndex = prodBase + products.length;

  const opt = (i: number) => ({
    id: optionId(i),
    role: "option" as const,
    "aria-selected": active === i,
    "data-active": active === i ? "" : undefined,
    tabIndex: -1,
    onMouseEnter: () => onActive(i),
    onClick: onNavigate,
  });

  return (
    <div
      id={id}
      role="listbox"
      aria-label="Подсказки поиска"
      style={style}
      className="absolute left-0 top-[calc(100%+6px)] z-[90] w-full overflow-y-auto overscroll-contain rounded-[10px] bg-white p-[16px] shadow-card animate-fade-in max-h-[calc(100dvh-190px)] md:max-h-[calc(100dvh-130px)]"
    >
      {!left && !right ? (
        loaded ? (
          <p className="px-[4px] py-[6px] text-[14px] leading-[20px] text-sub">Ничего не найдено по запросу «{term}»</p>
        ) : (
          <p className="px-[4px] py-[6px] text-[14px] leading-[20px] text-muted">Ищем…</p>
        )
      ) : (
        <div className={cn("flex flex-col gap-[20px]", left && right && "lg:grid lg:grid-cols-[minmax(0,372fr)_minmax(0,384fr)] lg:gap-0")}>
          {left ? (
            <div className={cn("min-w-0", right && "lg:pr-[18px]")}>
              {categories.length > 0 ? (
                <div role="group" aria-labelledby={`${id}-cat`}>
                  <p id={`${id}-cat`} className={label}>
                    <IconGoTo className="shrink-0" />
                    Перейти в категорию
                  </p>
                  <ul className="mt-[12px] flex flex-col gap-[8px] lg:gap-[10px]" role="presentation">
                    {categories.map((c, k) => (
                      <li key={c.slug} role="presentation">
                        <Link
                          href={`/catalog/${c.slug}`}
                          {...opt(catBase + k)}
                          className="flex min-h-[62px] items-center gap-[12px] rounded-[10px] bg-btn py-[8px] pl-[8px] pr-[14px] lg:min-h-[76px] lg:gap-[14px] lg:py-[10px] lg:pl-[10px] lg:pr-[16px] transition-colors hover:bg-btn-hover data-[active]:bg-btn-hover"
                        >
                          <ImageBox src={c.image} alt="" label={c.name} className="size-[46px] shrink-0 lg:size-[56px]" sizes="56px" rounded="rounded-[6px]" />
                          <span className="line-clamp-2 min-w-0 flex-1 text-[15px] font-medium leading-[19px] text-black">{c.name}</span>
                          <IconRowChevron className="shrink-0 text-muted" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {brands.length > 0 ? (
                <div role="group" aria-labelledby={`${id}-brand`} className={categories.length > 0 ? "mt-[18px]" : undefined}>
                  <p id={`${id}-brand`} className={label}>
                    <IconGoTo className="shrink-0" />
                    Бренды
                  </p>
                  <ul className="mt-[12px] flex flex-col gap-[8px] lg:gap-[10px]" role="presentation">
                    {brands.map((b, k) => (
                      <li key={b.slug} role="presentation">
                        <Link
                          href={`/brands/${b.slug}`}
                          {...opt(brandBase + k)}
                          className="flex min-h-[60px] items-center gap-[14px] rounded-[10px] bg-btn py-[8px] pl-[10px] pr-[16px] transition-colors hover:bg-btn-hover data-[active]:bg-btn-hover"
                        >
                          <ImageBox src={brandLogo(b)} alt="" label={b.name} className="h-[44px] w-[56px] shrink-0" imgClassName="p-[4px]" sizes="56px" rounded="rounded-[6px]" />
                          <span className="line-clamp-2 min-w-0 flex-1 text-[15px] font-medium leading-[19px] text-black">{b.name}</span>
                          <IconRowChevron className="shrink-0 text-muted" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {right ? (
            <div role="group" aria-labelledby={`${id}-prod`} className={cn("min-w-0", left && "lg:border-l lg:border-line-2 lg:pl-[18px]")}>
              <div className="flex items-center justify-between gap-3 pr-[4px]">
                <p id={`${id}-prod`} className={cn(label, "pl-[4px]")}>
                  Товары
                </p>
                <Link
                  href={allHref}
                  {...opt(allIndex)}
                  className="flex items-center gap-[6px] rounded-[4px] text-[14px] font-medium leading-[18px] text-link transition-colors hover:text-black data-[active]:text-black data-[active]:underline"
                >
                  Смотреть все
                  <IconArrowRight className="shrink-0" />
                </Link>
              </div>
              <ul className="mt-[6px] flex flex-col" role="presentation">
                {products.map((p, k) => (
                  <li key={p.slug} role="presentation">
                    <Link
                      href={`/product/${p.slug}`}
                      {...opt(prodBase + k)}
                      className="group flex gap-[14px] rounded-[8px] px-[4px] py-[10px] transition-colors hover:bg-surface data-[active]:bg-surface"
                    >
                      <ImageBox src={p.image} alt="" label={p.name} className="size-[56px] shrink-0" sizes="56px" rounded="rounded-[6px]" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-[16px] text-muted">
                          Код: <span className="text-g333 tnum">{p.code}</span>
                        </span>
                        <span className="mt-[3px] line-clamp-2 text-[14px] leading-[18px] text-g333 transition-colors group-hover:text-black group-data-[active]:text-black">{p.name}</span>
                        <span className="mt-[4px] flex items-baseline gap-[8px]">
                          <span className="text-[15px] font-bold leading-[18px] text-black tnum">{money(p.price)}</span>
                          {p.in_stock ? null : <span className="text-[12px] leading-[15px] text-muted">нет в наличии</span>}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Пункты в порядке навигации стрелками — тот же порядок, что и в разметке SearchDropdown. */
export function searchOptions(term: string, categories: SuggestCategory[], brands: SuggestBrand[], products: SuggestProduct[]): SearchOption[] {
  const out: SearchOption[] = [
    ...categories.map((c) => ({ key: `c:${c.slug}`, href: `/catalog/${c.slug}` })),
    ...brands.map((b) => ({ key: `b:${b.slug}`, href: `/brands/${b.slug}` })),
    ...products.map((p) => ({ key: `p:${p.slug}`, href: `/product/${p.slug}` })),
  ];
  if (products.length > 0) out.push({ key: "all", href: `/search?q=${encodeURIComponent(term)}` });
  return out;
}
