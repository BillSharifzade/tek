import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Brand, CategoryPage } from "@/lib/types";
import { optional, publicGet, safe } from "@/lib/server";
import { toProductsQuery, type SearchParams } from "@/lib/catalog-params";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Filters } from "@/components/catalog/Filters";
import { Listing } from "@/components/catalog/Listing";
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
  const page = await optional(publicGet<CategoryPage>(`/catalog/categories/${slug}`));
  if (!page) notFound();

  const brandSlugs = Array.isArray(sp.brand) ? sp.brand : sp.brand ? [sp.brand] : [];
  const singleBrand = brandSlugs.length === 1 ? await safe(optional(publicGet<{ brand: Brand }>(`/brands/${brandSlugs[0]}`)), null) : null;

  const query = toProductsQuery(sp, { category: slug });
  const pathname = `/catalog/${slug}`;

  return (
    <div className="container-page">
      <Breadcrumbs items={[...page.breadcrumbs.slice(0, -1).map((c) => ({ href: `/catalog/${c.slug}`, label: c.name })), { label: page.category.name }]} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div className="order-2 lg:order-1">
          <Filters subcategories={page.children} brands={page.brands} filters={page.filters} priceRange={page.price_range} />
        </div>
        <div className="order-1 min-w-0 lg:order-2">
          {singleBrand ? <BrandTile brand={singleBrand.brand} allHref={`/brands/${singleBrand.brand.slug}`} /> : null}
          <Listing query={query} pathname={pathname} searchParams={sp} title={page.category.name} />
          {page.category.description ? (
            <div className="prose-tek mt-10 rounded-[8px] border border-line bg-white p-6" dangerouslySetInnerHTML={{ __html: page.category.description }} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
