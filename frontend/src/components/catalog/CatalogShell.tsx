import { cn } from "@/lib/cn";
import { Breadcrumbs, type CrumbItem } from "@/components/ui/Breadcrumbs";
import { CatalogTitle } from "./Listing";
import { FiltersToggle } from "./FiltersToggle";

/**
 * Каркас страниц листинга по макету «Каталог» (10683:1085 / 10745:5085), контент 1260px (x=126):
 * крошки y=157 → заголовок y=188 → [плитки подкатегорий y=247] → колонка фильтров 240px (x=127) | результаты (x=376).
 */
export function CatalogShell({
  crumbs,
  title,
  count,
  tiles,
  filters,
  children,
  after,
}: {
  crumbs: CrumbItem[];
  title: React.ReactNode;
  count?: number;
  /** ряд плиток подкатегорий над фильтрами */
  tiles?: React.ReactNode;
  /** null — без колонки фильтров (пустой запрос поиска) */
  filters: React.ReactNode;
  children: React.ReactNode;
  /** под сеткой на всю ширину (описание категории) */
  after?: React.ReactNode;
}) {
  return (
    <div className="container-page pb-[78px]">
      <Breadcrumbs items={crumbs} className="pt-[20px] lg:pt-[43px]" />
      <CatalogTitle title={title} count={count} className="mt-[8px]" />
      {tiles ? <div className="mt-[28px] lg:ml-[1px] lg:mt-[36px]">{tiles}</div> : null}
      <div className={cn("grid grid-cols-1 gap-[24px] lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-0", tiles ? "mt-[28px] lg:mt-[57px]" : "mt-[28px] lg:mt-[41px]")}>
        {/* без фильтров (пустой поиск) — колонка остаётся пустой, кнопка «Фильтры» на мобильных не показывается */}
        <div className={cn("lg:pl-[1px] lg:pt-[11px]", !filters && "max-lg:hidden")}>{filters ? <FiltersToggle>{filters}</FiltersToggle> : null}</div>
        {children}
      </div>
      {after}
    </div>
  );
}
