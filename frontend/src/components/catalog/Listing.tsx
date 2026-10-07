import type { Paginated, ProductCard as ProductCardT } from "@/lib/types";
import type { Query } from "@/lib/api";
import { personalizedGet } from "@/lib/server";
import { buildHref, type SearchParams } from "@/lib/catalog-params";
import { cn } from "@/lib/cn";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Pagination } from "@/components/ui/Pagination";
import { SortBar } from "./SortBar";

export type ListingData = Paginated<ProductCardT>;

/** GET /catalog/products with personalized (B2B) prices. */
export function fetchListing(query: Query): Promise<ListingData> {
  return personalizedGet<ListingData>("/catalog/products", query);
}

/**
 * Заголовок страницы каталога (макет «Каталог»): «Название» Bold 26 + « (1322)» Regular 16 #808080. В Figma line-height 15; здесь 31 (базовая линия ровно на 8px ниже — компенсируется отступом −8), чтобы длинный заголовок переносился без наложения строк.
 */
export function CatalogTitle({ title, count, className }: { title: React.ReactNode; count?: number; className?: string }) {
  return (
    <h1 className={cn("text-[26px] font-bold leading-[31px] text-black", className)}>
      {title}
      {count !== undefined ? (
        <>
          {" "}
          <span className="text-[16px] font-normal leading-[10px] text-muted tnum">({count})</span>
        </>
      ) : null}
    </h1>
  );
}

/**
 * Сетка 4×N (ProductGrid cols=4, ряды через 82px) с разделителем #EBEDF8 посередине между рядами
 * (макет: линия 1018px на 523px ниже верха ряда; карточка — фиксированные 483px).
 * Колонки макета: x 376 / 637 / 898 / 1159 — зазор ровно 35px (сетка 1009px в колонке 1010px), поэтому на xl зазор
 * min(35px, (ширина − 4×226)/3) от левого края, а не justify-between (тот сдвигал 2–4-ю колонки на 0.3–1px вправо);
 * в узком xl-окне (1280–1291px) зазор ужимается и сетка не вылезает за колонку.
 */
export function ProductRows({ products, className }: { products: ProductCardT[]; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-[calc(100%+8px)] xl:block"
        style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 523px, #EBEDF8 523px 524px, transparent 524px 565px)" }}
      />
      <ProductGrid products={products} cols={4} priorityCount={4} className="relative xl:justify-start xl:gap-x-[min(35px,calc((100%_-_904px)/3))]" />
    </div>
  );
}

export function EmptyListing({ text, className }: { text?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-[10px] bg-surface-2 px-[20px] py-[64px] text-center", className)}>
      <p className="text-[18px] font-bold leading-[22px] text-black">{text ?? "Товары не найдены"}</p>
      <p className="mt-[10px] text-[14px] leading-[17px] text-sub">Попробуйте изменить фильтры или запрос.</p>
    </div>
  );
}

/** Правая колонка листинга: сортировка → сетка → пагинация. */
export function ListingResults({
  data,
  pathname,
  searchParams,
  emptyText,
  top,
}: {
  data: ListingData;
  pathname: string;
  searchParams: SearchParams;
  emptyText?: string;
  /** блок над сортировкой (например, плитка бренда) */
  top?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      {top}
      <SortBar pathname={pathname} searchParams={searchParams} />
      {data.items.length > 0 ? (
        <>
          <ProductRows products={data.items} className="mt-[28px]" />
          <Pagination page={data.page} pages={data.pages} hrefFor={(p) => buildHref(pathname, searchParams, { page: p > 1 ? String(p) : null })} className="mt-[60px]" />
        </>
      ) : (
        <EmptyListing text={emptyText} className="mt-[28px]" />
      )}
    </div>
  );
}

export interface ListingProps {
  query: Query;
  pathname: string;
  searchParams: SearchParams;
  title?: React.ReactNode;
  emptyText?: string;
}

/** Server component (brand pages): title with count + sort bar + grid + pagination. */
export async function Listing({ query, pathname, searchParams, title, emptyText }: ListingProps) {
  const data = await fetchListing(query);
  return (
    <div>
      {title ? <CatalogTitle title={title} count={data.total} className="mb-[19px]" /> : null}
      <ListingResults data={data} pathname={pathname} searchParams={searchParams} emptyText={emptyText} />
    </div>
  );
}
