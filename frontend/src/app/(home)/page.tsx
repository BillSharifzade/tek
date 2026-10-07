import type { CategoryNode, Home } from "@/lib/types";
import { personalizedGet, publicGet, safe } from "@/lib/server";
import { HomeTop } from "@/components/home/HomeTop";
import { BrandStrip } from "@/components/home/BrandStrip";
import { Directions } from "@/components/home/Directions";
import { UspRow } from "@/components/home/UspRow";
import { CategoryTiles } from "@/components/home/CategoryTiles";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ProjectCard } from "@/components/content/ProjectCard";
import { CenteredHeader } from "@/components/ui/Section";

/** Количество товаров по slug категории (любого уровня) — для подписей плиток категорий. */
function categoryCounts(tree: CategoryNode[]): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (nodes: CategoryNode[]) => {
    for (const n of nodes) {
      out[n.slug] = n.product_count;
      walk(n.children ?? []);
    }
  };
  walk(tree);
  return out;
}

/** Лендинг — Figma «Лендинг» 10999:2802 (контент под шапкой, y ≥ 113). */
export default async function HomePage() {
  const [home, tree] = await Promise.all([personalizedGet<Home>("/home"), safe(publicGet<CategoryNode[]>("/catalog/tree", undefined, 120), [])]);
  const fresh = home.new_products.length > 0 ? home.new_products : home.popular_products;

  return (
    <>
      <h1 className="sr-only">ТЭК — Точикэлектрокомплект: интернет-магазин электротехники в Таджикистане</h1>

      <HomeTop news={home.news} banners={home.banners} />
      {/* key: при другом наборе вендоров полоса начинает ротацию заново */}
      <BrandStrip key={home.brands.map((b) => b.slug).join(",")} brands={home.brands} />
      <Directions />
      <UspRow items={home.usp} />
      <CategoryTiles counts={categoryCounts(tree)} />

      {fresh.length > 0 ? (
        <section className="container-page mt-14 lg:mt-[69px]" aria-label="Новинки">
          <CenteredHeader title="Новинки" href="/catalog" cta="В каталог" />
          <ProductGrid products={fresh.slice(0, 5)} cols={5} className="mt-8 lg:mx-px max-md:[&>*:nth-child(5)]:hidden" />
        </section>
      ) : null}

      {home.projects.length > 0 ? (
        <section className="mt-16 bg-surface pb-14 pt-10 lg:mt-[87px] lg:pb-[87px] lg:pt-[52px]" aria-label="Реализованные проекты">
          <div className="container-page">
            <CenteredHeader title="Реализованные проекты" href="/projects" cta="Все проекты" />
            <ul className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:mr-px lg:mt-[44px] lg:grid-cols-3 lg:gap-[34px]">
              {home.projects.slice(0, 3).map((p, i) => (
                <li key={p.slug} className={i === 2 ? "md:hidden lg:block" : undefined}>
                  <ProjectCard project={p} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
