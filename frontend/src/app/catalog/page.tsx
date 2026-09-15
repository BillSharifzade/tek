import Link from "next/link";
import type { Metadata } from "next";
import type { CategoryNode } from "@/lib/types";
import { publicGet } from "@/lib/server";
import { countLabel } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ImageBox } from "@/components/ui/ImageBox";

export const metadata: Metadata = { title: "Каталог" };

export default async function CatalogPage() {
  const tree = await publicGet<CategoryNode[]>("/catalog/tree", undefined, 120);
  return (
    <div className="container-page">
      <Breadcrumbs items={[{ label: "Каталог" }]} />
      <h1 className="mb-8">Каталог</h1>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {tree.map((c) => (
          <section key={c.slug} className="flex gap-4 rounded-[8px] border border-line bg-white p-5">
            <Link href={`/catalog/${c.slug}`} className="shrink-0">
              <ImageBox src={c.image} alt={c.name} className="size-20" sizes="80px" />
            </Link>
            <div className="min-w-0">
              <Link href={`/catalog/${c.slug}`} className="text-lg font-semibold hover:text-brand-hover">
                {c.name}
              </Link>
              <p className="text-xs text-sub">{countLabel(c.product_count, ["товар", "товара", "товаров"])}</p>
              <ul className="mt-2 flex flex-col gap-1">
                {c.children.slice(0, 6).map((s) => (
                  <li key={s.slug}>
                    <Link href={`/catalog/${s.slug}`} className="text-sm text-sub hover:text-ink">
                      {s.name}
                    </Link>
                  </li>
                ))}
                {c.children.length > 6 ? (
                  <li>
                    <Link href={`/catalog/${c.slug}`} className="text-sm font-medium text-info">
                      Ещё {c.children.length - 6}
                    </Link>
                  </li>
                ) : null}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
