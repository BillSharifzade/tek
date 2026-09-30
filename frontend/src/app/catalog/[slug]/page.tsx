import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Brand, CategoryPage } from "@/lib/types";
import { optional, publicGet, safe } from "@/lib/server";
import { toProductsQuery, type SearchParams } from "@/lib/catalog-params";
import { Filters } from "@/components/catalog/Filters";
import { fetchListing, ListingResults } from "@/components/catalog/Listing";
import { CatalogShell } from "@/components/catalog/CatalogShell";
import { SubcategoryTiles } from "@/components/catalog/SubcategoryTiles";
import { BrandTile } from "@/components/catalog/BrandTile";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await optional(publicGet<CategoryPage>(`/catalog/categories/${slug}`));
  return { title: page?.category.name ?? "Каталог" };
}

export default async function CategoryRoute({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const pathname = `/catalog/${slug}`;
  const brandSlugs = Array.isArray(sp.brand) ? sp.brand : sp.brand ? [sp.brand] : [];

  // категория, товары и (при одном бренде) плитка бренда — параллельно
  const [page, data, singleBrand] = await Promise.all([
    optional(publicGet<CategoryPage>(`/catalog/categories/${slug}`)),
    fetchListing(toProductsQuery(sp, { category: slug })),
    brandSlugs.length === 1 ? safe(optional(publicGet<{ brand: Brand }>(`/brands/${brandSlugs[0]}`)), null) : Promise.resolve(null),
  ]);
  if (!page) notFound();

  return (
    <CatalogShell
      crumbs={[...page.breadcrumbs.slice(0, -1).map((c) => ({ href: `/catalog/${c.slug}`, label: c.name })), { label: page.category.name }]}
      title={page.category.name}
      count={data.total}
      tiles={page.children.length > 0 ? <SubcategoryTiles items={page.children} /> : null}
      filters={<Filters key={slug} brands={page.brands} filters={page.filters} priceRange={page.price_range} />}
      after={
        page.category.description ? (
          <div className="prose-tek mt-[60px] rounded-[10px] bg-surface-2 p-[24px]" dangerouslySetInnerHTML={{ __html: page.category.description }} />
        ) : null
      }
    >
      <ListingResults
        data={data}
        pathname={pathname}
        searchParams={sp}
        top={singleBrand ? <BrandTile brand={singleBrand.brand} allHref={`/brands/${singleBrand.brand.slug}`} /> : null}
      />
    </CatalogShell>
  );
}
