import type { Metadata } from "next";
import { publicGet, safe } from "@/lib/server";
import { firstParam, toProductsQuery, type SearchParams } from "@/lib/catalog-params";
import { Filters } from "@/components/catalog/Filters";
import { EmptyListing, fetchListing, ListingResults } from "@/components/catalog/Listing";
import { CatalogShell } from "@/components/catalog/CatalogShell";
import { SubcategoryTiles } from "@/components/catalog/SubcategoryTiles";

interface Props {
  searchParams: Promise<SearchParams>;
}

interface Suggest {
  categories: { slug: string; name: string; image: string | null }[];
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = firstParam((await searchParams).q)?.trim();
  return { title: q ? `Поиск: ${q}` : "Поиск" };
}

/** Результаты поиска — тот же листинг, что и каталог (макет «Каталог»), + совпавшие категории плитками. */
export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = firstParam(sp.q)?.trim() ?? "";

  if (!q) {
    return (
      <CatalogShell crumbs={[{ label: "Результаты поиска" }]} title="Результаты поиска" filters={null}>
        <EmptyListing text="Введите код, наименование или бренд товара в строку поиска" />
      </CatalogShell>
    );
  }

  const [data, suggest] = await Promise.all([
    fetchListing(toProductsQuery(sp, { q })),
    q.length >= 2 ? safe(publicGet<Suggest>("/catalog/suggest", { q }), { categories: [] }) : Promise.resolve({ categories: [] }),
  ]);

  return (
    <CatalogShell
      crumbs={[{ label: "Результаты поиска" }]}
      title={<>Результаты поиска «{q}»</>}
      count={data.total}
      tiles={suggest.categories.length > 0 ? <SubcategoryTiles items={suggest.categories} /> : null}
      filters={<Filters key={q} brands={[]} filters={[]} priceRange={null} />}
    >
      <ListingResults data={data} pathname="/search" searchParams={sp} emptyText={`По запросу «${q}» ничего не найдено`} />
    </CatalogShell>
  );
}
