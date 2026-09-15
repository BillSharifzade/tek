import Link from "next/link";
import type { Metadata } from "next";
import type { Brand } from "@/lib/types";
import { publicGet } from "@/lib/server";
import { countLabel } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ImageBox } from "@/components/ui/ImageBox";

export const metadata: Metadata = { title: "Бренды" };

function BrandGrid({ items }: { items: Brand[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((b) => (
        <li key={b.slug}>
          <Link href={`/brands/${b.slug}`} className="group flex h-full flex-col items-center rounded-[8px] border border-line bg-white p-5 text-center transition-colors hover:border-brand">
            <span className="flex h-16 w-full items-center justify-center">
              {b.logo ? <ImageBox src={b.logo} alt={b.name} className="h-14 w-full" sizes="200px" rounded="rounded-none" /> : <span className="text-xl font-bold">{b.name}</span>}
            </span>
            <span className="mt-3 text-base font-semibold group-hover:text-brand-hover">{b.name}</span>
            <span className="mt-0.5 text-xs text-sub">{b.country_brand ? `${b.country_brand} · ` : ""}{countLabel(b.product_count, ["товар", "товара", "товаров"])}</span>
          </Link>
        </li>
      ))}
    </ul>
    );
}

export default async function BrandsPage() {
  const brands = await publicGet<Brand[]>("/brands", undefined, 300);
  const featured = brands.filter((b) => b.is_featured);
  const rest = brands.filter((b) => !b.is_featured);


  return (
    <div className="container-page">
      <Breadcrumbs items={[{ label: "Бренды" }]} />
      <h1>Бренды</h1>
      <p className="mt-2 max-w-2xl text-sub">Широкий выбор оригинальной продукции ведущих мировых производителей электротехнической продукции.</p>
      {featured.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-4">Ключевые партнёры</h2>
          <BrandGrid items={featured} />
        </section>
      ) : null}
      {rest.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-4">Все бренды</h2>
          <BrandGrid items={rest} />
        </section>
      ) : null}
    </div>
  );
}
