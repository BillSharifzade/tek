import type { CategoryNode, Home } from "@/lib/types";
import { personalizedGet, publicGet, safe } from "@/lib/server";
import { HomeTop } from "@/components/home/HomeTop";
import { BrandStrip } from "@/components/home/BrandStrip";
import { Directions } from "@/components/home/Directions";
import { UspRow } from "@/components/home/UspRow";
import { CategoryTiles, type CategoryTileData } from "@/components/home/CategoryTiles";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ProjectCard } from "@/components/content/ProjectCard";
import { CenteredHeader } from "@/components/ui/Section";

const TILE_COUNT = 11;

/** Популярные категории из /home; если их меньше 11 плиток макета — добираем самыми наполненными подкатегориями. */
function categoryTiles(popular: Home["popular_categories"], tree: CategoryNode[]): CategoryTileData[] {
  const out: CategoryTileData[] = popular.filter((c) => c.product_count > 0).slice(0, TILE_COUNT);
  if (out.length >= TILE_COUNT) return out;
  const seen = new Set(out.map((c) => c.slug));
  const pool: CategoryTileData[] = [];
  const walk = (nodes: CategoryNode[]) => {
    for (const n of nodes) {
      if (!seen.has(n.slug) && n.product_count > 0) pool.push({ slug: n.slug, name: n.name, image: n.image, product_count: n.product_count });
      walk(n.children ?? []);
    }
  };
  walk(tree.flatMap((n) => n.children ?? []));
  pool.sort((a, b) => b.product_count - a.product_count);
  return [...out, ...pool.slice(0, TILE_COUNT - out.length)];
}

/** Лендинг — Figma «Лендинг» 10999:2802 (контент под шапкой, y ≥ 113). */
export default async function HomePage() {
  const [home, tree] = await Promise.all([personalizedGet<Home>("/home"), safe(publicGet<CategoryNode[]>("/catalog/tree", undefined, 120), [])]);
  const fresh = home.new_products.length > 0 ? home.new_products : home.popular_products;

  return (
    <>
      <h1 className="sr-only">ТЭК — Точикэлектрокомплект: интернет-магазин электротехники в Таджикистане</h1>

      <HomeTop news={home.news} />
      <BrandStrip brands={home.brands} />
      <Directions />
      <UspRow items={home.usp} />
      <CategoryTiles items={categoryTiles(home.popular_categories, tree)} />

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
