"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { CATALOG_BRANDS, CATALOGS } from "./catalogs";

const PAGE = 12;

/**
 * Каталоги и брошюры: фильтр-пилюли как «Вендоры» на странице проектов (10554:307 — h32 r7, 13/18,
 * активная #FFCC33, остальные #EEF0F2 → hover #D9DDE3) и сетка обложек 6 в ряд.
 */
export function CatalogLibrary() {
  const [brand, setBrand] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    CATALOGS.forEach((c) => m.set(c.brand, (m.get(c.brand) ?? 0) + 1));
    return m;
  }, []);
  const list = brand ? CATALOGS.filter((c) => c.brand === brand) : CATALOGS;
  const names = new Map(CATALOG_BRANDS.map((b) => [b.slug, b.name]));

  const pill = (active: boolean) =>
    cn("inline-flex h-[32px] items-center gap-[6px] whitespace-nowrap rounded-[7px] px-[19px] text-[13px] leading-[18px] text-black transition-colors", active ? "bg-brand hover:bg-brand-hover" : "bg-btn hover:bg-btn-hover");

  return (
    <div>
      <div className="flex flex-wrap gap-[8px]" role="group" aria-label="Производитель">
        <button type="button" className={pill(brand === null)} aria-pressed={brand === null} onClick={() => (setBrand(null), setLimit(PAGE))}>
          Все
          <span className="text-sub tnum">{CATALOGS.length}</span>
        </button>
        {CATALOG_BRANDS.map((b) => (
          <button key={b.slug} type="button" className={pill(brand === b.slug)} aria-pressed={brand === b.slug} onClick={() => (setBrand(b.slug), setLimit(PAGE))}>
            {b.name}
            <span className="text-sub tnum">{counts.get(b.slug) ?? 0}</span>
          </button>
        ))}
      </div>

      <ul className="mt-[24px] grid grid-cols-2 gap-x-[13px] gap-y-[24px] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {list.slice(0, limit).map((c) => (
          <li key={c.n}>
            <a href={c.file} target="_blank" rel="noopener noreferrer" className="group flex h-full flex-col">
              <span className="relative flex aspect-[199/230] items-center justify-center overflow-hidden rounded-[8px] bg-surface p-[18px]">
                <Image src={`/corporate/catalogs/${c.n}.webp`} alt="" width={180} height={240} unoptimized className="h-auto max-h-full w-auto max-w-full shadow-card transition-transform duration-300 group-hover:scale-[1.04]" />
              </span>
              <span className="mt-[10px] line-clamp-3 text-[14px] leading-[18px] text-g333 transition-colors group-hover:text-black">{c.name}</span>
              <span className="mt-auto pt-[6px] text-[13px] leading-[18px] text-muted">
                {names.get(c.brand)} · <span className="underline underline-offset-2 group-hover:text-black">PDF</span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      {list.length > limit ? (
        <div className="mt-[32px] flex justify-center">
          <Button variant="secondary" size="md" onClick={() => setLimit((l) => l + PAGE * 2)} className="px-[24px]">
            Показать ещё {list.length - limit}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
