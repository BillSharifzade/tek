import Link from "next/link";
import type { Brand } from "@/lib/types";
import { cn } from "@/lib/cn";
import { ImageBox } from "@/components/ui/ImageBox";

/**
 * «ДКС / Все товары > / Россия - страна бренда / Россия - страна производства» над листингом, отфильтрованным по бренду.
 * В языке блока «Инфа о бренде» карточки товара (8612:295): белая карточка r=10, тень 0 2 7 2 /8%,
 * название SemiBold 16, «Все товары >» Regular 14 #1C3697, страны Regular 14 #666, логотип справа ~119×40.
 */
export function BrandTile({ brand, allHref, className }: { brand: Brand; allHref?: string; className?: string }) {
  return (
    <div className={cn("mb-[28px] flex items-center gap-[20px] rounded-[10px] bg-white px-[26px] py-[16px] shadow-pop", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-[16px] gap-y-[4px]">
          <h2 className="text-[16px] font-semibold leading-[20px] text-black">{brand.name}</h2>
          {allHref ? (
            <Link href={allHref} className="text-[14px] leading-[20px] text-link link-hover">
              Все товары &gt;
            </Link>
          ) : null}
        </div>
        {brand.country_brand || brand.country_origin ? (
          <ul className="mt-[8px] flex flex-wrap gap-x-[24px] gap-y-[4px] text-[14px] leading-[20px] text-sub">
            {brand.country_brand ? <li>{brand.country_brand} - страна бренда</li> : null}
            {brand.country_origin ? <li>{brand.country_origin} - страна производства</li> : null}
          </ul>
        ) : null}
        {brand.description ? <p className="mt-[8px] line-clamp-2 text-[14px] leading-[20px] text-sub">{brand.description}</p> : null}
      </div>
      {brand.logo ? (
        <ImageBox src={brand.logo} alt={brand.name} className="hidden h-[40px] w-[120px] shrink-0 sm:block" sizes="120px" rounded="rounded-none" />
      ) : null}
    </div>
  );
}
