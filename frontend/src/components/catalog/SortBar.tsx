import Link from "next/link";
import { SORTS, buildHref, sortKeyOf, DEFAULT_SORT, type SearchParams } from "@/lib/catalog-params";
import { cn } from "@/lib/cn";
import { IconSortDown, IconSortUp } from "./icons";

/** Фиксированные ширины кнопок из макета (10683:1085): 103 / 111 / 107 / 106, зазор 4. */
const WIDTH: Record<string, string> = {
  price_desc: "w-[103px]",
  price_asc: "w-[111px]",
  rating: "w-[107px]",
  reviews: "w-[106px]",
};

/**
 * «Сортировка:» (SemiBold 13) + сегмент-кнопки h=32 r=5: активная #FFCC33, остальные #F0F2F4.
 * Ссылки (без клиентского JS): sort хранится в URL, страница сбрасывается.
 */
export function SortBar({ pathname, searchParams, className }: { pathname: string; searchParams: SearchParams; className?: string }) {
  const active = sortKeyOf(searchParams.sort);
  return (
    <div className={cn("flex flex-wrap items-center gap-y-[8px]", className)}>
      <span className="relative -top-[1px] mr-[12px] w-[77px] text-[13px] font-semibold leading-[12px] text-black">Сортировка:</span>
      <ul className="flex flex-wrap gap-[4px]">
        {SORTS.map((s) => {
          const on = s.key === active;
          const Icon = s.icon === "up" ? IconSortUp : s.icon === "down" ? IconSortDown : null;
          return (
            <li key={s.key}>
              <Link
                href={buildHref(pathname, searchParams, { sort: s.key === DEFAULT_SORT ? null : s.key })}
                scroll={false}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "relative block h-[32px] rounded-[5px] text-black transition-colors",
                  WIDTH[s.key],
                  on ? "bg-brand hover:bg-brand-hover" : "bg-field hover:bg-btn-hover",
                )}
              >
                {Icon ? <Icon className={cn("absolute left-[17px]", s.icon === "up" ? "top-[9px]" : "top-[7px]")} /> : null}
                <span className={cn("absolute top-[9px] whitespace-nowrap text-[13px] leading-[12px]", Icon ? "left-[40px]" : "left-[18px]")}>{s.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
