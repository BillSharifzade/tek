import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { BrandPage } from "@/lib/types";
import { optional, publicGet } from "@/lib/server";
import { buildHref, toProductsQuery, type SearchParams } from "@/lib/catalog-params";
import { cn } from "@/lib/cn";
import { CatalogShell } from "@/components/catalog/CatalogShell";
import { Filters } from "@/components/catalog/Filters";
import { fetchListing, ListingResults } from "@/components/catalog/Listing";
import { IconArrowSmall } from "@/components/content/icons";
import { brandLogo, CERTIFICATES } from "@/components/content/brands";
import { CATALOGS } from "@/components/content/catalogs";
import { asset } from "@/lib/asset";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await optional(publicGet<BrandPage>(`/brands/${slug}`));
  return { title: page ? `${page.brand.name} — все товары бренда` : "Бренд", description: page?.brand.description ?? undefined };
}

export default async function BrandRoute({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [page, data] = await Promise.all([optional(publicGet<BrandPage>(`/brands/${slug}`)), fetchListing(toProductsQuery(sp, { brand: slug }))]);
  if (!page) notFound();
  const { brand, categories } = page;
  const logo = brandLogo(brand);
  const cert = CERTIFICATES.find((c) => c.slug === slug);
  const docs = CATALOGS.filter((c) => c.brand === slug).length;
  const pathname = `/brands/${slug}`;
  const activeCat = typeof sp.category === "string" ? sp.category : null;

  const link = "inline-flex items-center gap-[5px] text-[14px] leading-[20px] text-g333 underline underline-offset-[3px] transition-colors hover:text-black";

  return (
    <CatalogShell
      crumbs={[{ href: "/brands", label: "Бренды" }, { label: brand.name }]}
      title={brand.name}
      count={data.total}
      tiles={
        // карточка бренда: серая плашка #F7F8F9 r10, логотип на белом, страны — пилюли, ссылки на сертификат и каталоги
        <div className="flex flex-col gap-[20px] rounded-[10px] bg-surface-2 p-[16px] sm:flex-row sm:items-center md:gap-[28px] md:p-[20px]">
          <div className="flex h-[100px] w-full shrink-0 items-center justify-center rounded-[10px] bg-white px-[20px] sm:w-[220px]">
            {logo ? <Image src={logo} alt={brand.name} width={180} height={60} className="h-auto max-h-[56px] w-auto max-w-[170px] object-contain" /> : <span className="text-[22px] font-bold">{brand.name}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <ul className="flex flex-wrap gap-[8px]">
              {brand.country_brand ? <li className="inline-flex h-[24px] items-center rounded-[15px] bg-white px-[11px] text-[13px] leading-[18px] text-g333">Страна бренда: {brand.country_brand}</li> : null}
              {brand.country_origin ? <li className="inline-flex h-[24px] items-center rounded-[15px] bg-white px-[11px] text-[13px] leading-[18px] text-g333">Производство: {brand.country_origin}</li> : null}
            </ul>
            {brand.description ? <p className="mt-[10px] max-w-[760px] text-[15px] leading-[23px] text-g333">{brand.description}</p> : null}
          </div>
          {cert || docs > 0 ? (
            <div className="flex shrink-0 flex-col gap-[8px] sm:pr-[8px]">
              {cert ? (
                <a href={asset(`/corporate/certs/${cert.n}.webp`)} target="_blank" rel="noopener" className={link}>
                  Сертификат дистрибьютора
                  <IconArrowSmall className="size-[11px]" />
                </a>
              ) : null}
              {docs > 0 ? (
                <Link href="/support#catalogs" className={link}>
                  Каталоги PDF ({docs})
                  <IconArrowSmall className="size-[11px]" />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      }
      filters={
        <div>
          {categories.length > 0 ? (
            <nav aria-label="Категории бренда" className="pb-[20px] lg:pb-[42px]">
              <p className="hidden text-[14px] font-bold leading-[16px] text-black lg:block">Категории</p>
              {/* мобайл — пилюли в строку с прокруткой (как фильтр вендоров на «Проектах»), десктоп — список как в фильтрах */}
              <ul className="-mx-4 flex gap-[8px] overflow-x-auto px-4 scrollbar-none lg:mx-0 lg:mt-[17px] lg:flex-col lg:gap-[7px] lg:overflow-visible lg:px-0">
                {[{ slug: null as string | null, name: "Все товары", product_count: brand.product_count }, ...categories].map((c) => {
                  const on = c.slug === activeCat;
                  return (
                    <li key={c.slug ?? "all"} className="shrink-0">
                      <Link
                        href={buildHref(pathname, sp, { category: c.slug, page: null })}
                        className={cn(
                          "inline-flex h-[32px] items-center whitespace-nowrap rounded-[7px] px-[14px] text-[13px] leading-[18px] transition-colors lg:h-auto lg:whitespace-normal lg:rounded-none lg:bg-transparent lg:px-0 lg:text-[14px] lg:leading-[17px] lg:hover:bg-transparent",
                          on ? "bg-brand text-black lg:font-medium" : "bg-btn text-g333 hover:bg-btn-hover lg:text-sub lg:hover:text-black",
                        )}
                      >
                        {c.name}&nbsp;<span className="tnum text-muted">({c.product_count})</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ) : null}
          <Filters brands={[]} filters={[]} priceRange={null} hideBrands />
        </div>
      }
    >
      <ListingResults data={data} pathname={pathname} searchParams={sp} emptyText={`Товары ${brand.name} скоро появятся в каталоге`} />
    </CatalogShell>
  );
}
