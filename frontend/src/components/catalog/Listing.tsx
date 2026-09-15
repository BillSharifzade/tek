import { SearchX } from "lucide-react";
import type { Paginated, ProductCard as ProductCardT } from "@/lib/types";
import type { Query } from "@/lib/api";
import { personalizedGet } from "@/lib/server";
import { buildHref, type SearchParams } from "@/lib/catalog-params";
import { countLabel } from "@/lib/format";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Pagination } from "@/components/ui/Pagination";
import { SortSelect } from "./SortSelect";

export interface ListingProps {
  query: Query;
  pathname: string;
  searchParams: SearchParams;
  title?: React.ReactNode;
  emptyText?: string;
}

/** Server component: fetches GET /catalog/products with personalized prices and renders the grid. */
export async function Listing({ query, pathname, searchParams, title, emptyText }: ListingProps) {
  const data = await personalizedGet<Paginated<ProductCardT>>("/catalog/products", query);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          {title ? <h1 className="text-3xl font-semibold">{title}</h1> : null}
          <span className="text-sm text-sub tnum">{countLabel(data.total, ["товар", "товара", "товаров"])}</span>
        </div>
        <SortSelect />
      </div>
      {data.items.length > 0 ? (
        <>
          <ProductGrid products={data.items} cols={4} priorityCount={4} />
          <Pagination page={data.page} pages={data.pages} hrefFor={(p) => buildHref(pathname, searchParams, { page: p > 1 ? String(p) : null })} className="mt-10" />
        </>
      ) : (
        <div className="flex flex-col items-center rounded-[8px] border border-dashed border-line py-20 text-center">
          <SearchX className="size-10 text-muted" />
          <p className="mt-4 text-lg font-medium">{emptyText ?? "Товары не найдены"}</p>
          <p className="mt-1 text-sm text-sub">Попробуйте изменить фильтры или запрос.</p>
        </div>
      )}
    </div>
  );
}
