import type { Metadata } from "next";
import { toProductsQuery, type SearchParams } from "@/lib/catalog-params";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Listing } from "@/components/catalog/Listing";
import { Filters } from "@/components/catalog/Filters";

interface Props {
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  return { title: q ? `Поиск: ${q}` : "Поиск" };
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";
  const query = toProductsQuery(sp, { q });

  return (
    <div className="container-page">
      <Breadcrumbs items={[{ label: "Поиск" }]} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div className="order-2 lg:order-1">
          <Filters brands={[]} filters={[]} priceRange={null} />
        </div>
        <div className="order-1 min-w-0 lg:order-2">
          {q ? (
            <Listing query={query} pathname="/search" searchParams={sp} title={<>Результаты по запросу «{q}»</>} emptyText={`По запросу «${q}» ничего не найдено`} />
          ) : (
            <div className="rounded-[8px] border border-dashed border-line py-20 text-center">
              <h1>Поиск</h1>
              <p className="mt-2 text-sub">Введите код, наименование или бренд товара в строку поиска.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
