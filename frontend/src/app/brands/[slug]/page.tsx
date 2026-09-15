import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { BrandPage } from "@/lib/types";
import { optional, publicGet } from "@/lib/server";
import { toProductsQuery, type SearchParams } from "@/lib/catalog-params";
import { countLabel } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { BrandTile } from "@/components/catalog/BrandTile";
import { Filters } from "@/components/catalog/Filters";
import { Listing } from "@/components/catalog/Listing";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await optional(publicGet<BrandPage>(`/brands/${slug}`));
  return { title: page ? `${page.brand.name} — все товары бренда` : "Бренд" };
}

export default async function BrandRoute({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const page = await optional(publicGet<BrandPage>(`/brands/${slug}`));
  if (!page) notFound();
  const query = toProductsQuery(sp, { brand: slug });

  return (
    <div className="container-page">
      <Breadcrumbs items={[{ href: "/brands", label: "Бренды" }, { label: page.brand.name }]} />
      <BrandTile brand={page.brand} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div className="order-2 lg:order-1 flex flex-col gap-4">
          {page.categories.length > 0 ? (
            <nav aria-label="Категории бренда" className="rounded-[8px] border border-line bg-white p-5">
              <h3 className="mb-3">Категории</h3>
              <ul className="flex flex-col gap-1.5">
                {page.categories.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/catalog/${c.slug}?brand=${slug}`} className="flex items-center justify-between gap-2 text-base hover:text-brand-hover">
                      {c.name}
                      <span className="text-xs text-muted tnum">{c.product_count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <Filters brands={[]} filters={[]} priceRange={null} hideBrands />
        </div>
        <div className="order-1 min-w-0 lg:order-2">
          <Listing query={query} pathname={`/brands/${slug}`} searchParams={sp} title={<>Товары {page.brand.name}</>} />
          <p className="mt-4 text-xs text-muted">{countLabel(page.brand.product_count, ["товар", "товара", "товаров"])} бренда в каталоге</p>
        </div>
      </div>
    </div>
  );
}
