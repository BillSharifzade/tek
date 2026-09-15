import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Brand } from "@/lib/types";
import { ImageBox } from "@/components/ui/ImageBox";

/** "ДКС — Россия - страна бренда / Россия - страна производства" tile shown above brand-filtered listings. */
export function BrandTile({ brand, allHref }: { brand: Brand; allHref?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-5 rounded-[8px] border border-line bg-white p-5 sm:flex-row sm:items-center">
      <div className="flex h-[72px] w-[160px] shrink-0 items-center justify-center rounded-[8px] border border-line bg-white px-3">
        {brand.logo ? <ImageBox src={brand.logo} alt={brand.name} className="h-12 w-full" sizes="160px" rounded="rounded-none" /> : <span className="text-xl font-bold">{brand.name}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-2xl font-semibold">{brand.name}</h2>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-sub">
          {brand.country_brand ? <li>{brand.country_brand} - страна бренда</li> : null}
          {brand.country_origin ? <li>{brand.country_origin} - страна производства</li> : null}
        </ul>
        {brand.description ? <p className="mt-2 line-clamp-2 text-sm text-sub">{brand.description}</p> : null}
      </div>
      {allHref ? (
        <Link href={allHref} className="inline-flex shrink-0 items-center gap-1 text-base font-medium hover:text-brand-hover">
          Все товары
          <ChevronRight className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}
