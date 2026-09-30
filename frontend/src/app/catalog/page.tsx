import Link from "next/link";
import type { Metadata } from "next";
import type { CategoryNode } from "@/lib/types";
import { publicGet } from "@/lib/server";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CatalogTitle } from "@/components/catalog/Listing";
import { SubcategoryTiles } from "@/components/catalog/SubcategoryTiles";

export const metadata: Metadata = { title: "Каталог" };

/**
 * Корень каталога (отдельного макета нет): шапка как у листинга «Каталог» (крошки y=157, заголовок Bold 26 + (N) #808080),
 * далее разделы — заголовок раздела и плитки подкатегорий 155×135 (как в макете 10745:5085).
 */
export default async function CatalogPage() {
  const tree = await publicGet<CategoryNode[]>("/catalog/tree", undefined, 120);
  const total = tree.reduce((s, c) => s + c.product_count, 0);
  return (
    <div className="container-page pb-[78px]">
      <Breadcrumbs items={[{ label: "Каталог" }]} className="pt-[20px] lg:pt-[43px]" />
      <CatalogTitle title="Каталог" count={total} className="mt-[8px]" />
      <div className="mt-[28px] grid grid-cols-1 gap-x-[30px] gap-y-[48px] lg:ml-[1px] lg:mt-[36px] lg:grid-cols-2">
        {tree.map((c) => (
          <section key={c.slug} aria-labelledby={`cat-${c.slug}`}>
            <h2 id={`cat-${c.slug}`} className="text-[20px] font-bold leading-[24px]">
              <Link href={`/catalog/${c.slug}`} className="link-hover">
                {c.name}
              </Link>{" "}
              <span className="text-[14px] font-normal text-muted tnum">({c.product_count})</span>
            </h2>
            <SubcategoryTiles className="mt-[20px]" items={c.children.length > 0 ? c.children : [c]} />
          </section>
        ))}
      </div>
    </div>
  );
}
