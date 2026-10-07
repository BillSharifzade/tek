import type { MetadataRoute } from "next";
import { connection } from "next/server";
import type { CategoryNode } from "@/lib/types";
import { publicGet, safe } from "@/lib/server";
import { SITE } from "@/lib/site";

interface Paged<T> {
  items: T[];
  pages: number;
}

const STATIC = ["/", "/catalog", "/brands", "/services", "/projects", "/news", "/configurators", "/about", "/vacancies", "/contacts", "/help", "/help/delivery", "/help/payment", "/help/warranty", "/help/faq", "/support"];

async function allPages<T>(path: string, perPage: number): Promise<T[]> {
  const first = await safe(publicGet<Paged<T>>(path, { per_page: perPage, page: 1 }, 3600), { items: [], pages: 0 });
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.pages - 1) }, (_, i) =>
      safe(publicGet<Paged<T>>(path, { per_page: perPage, page: i + 2 }, 3600), { items: [], pages: 0 }).then((r) => r.items),
    ),
  );
  return [...first.items, ...rest.flat()];
}

function flatten(nodes: CategoryNode[]): string[] {
  return nodes.flatMap((n) => [n.slug, ...flatten(n.children)]);
}

/** Собирается по запросу (при сборке образа API нет); данные API кешируются на час. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const [tree, products, news, projects, services, brands, configurators] = await Promise.all([
    safe(publicGet<CategoryNode[]>("/catalog/tree", undefined, 3600), []),
    allPages<{ slug: string }>("/catalog/products", 100),
    allPages<{ slug: string; date?: string }>("/content/news", 100),
    allPages<{ slug: string; date?: string }>("/content/projects", 100),
    safe(publicGet<{ slug: string }[]>("/content/services", undefined, 3600), []),
    safe(publicGet<{ slug: string }[]>("/brands", undefined, 3600), []),
    safe(publicGet<{ slug: string }[]>("/content/configurators", undefined, 3600), []),
  ]);
  const at = (path: string, priority: number, lastModified?: string): MetadataRoute.Sitemap[number] => ({
    url: `${SITE.url}${path}`,
    priority,
    ...(lastModified ? { lastModified } : {}),
  });
  return [
    ...STATIC.map((p) => at(p, p === "/" ? 1 : 0.6)),
    ...flatten(tree).map((s) => at(`/catalog/${s}`, 0.8)),
    ...products.map((p) => at(`/product/${p.slug}`, 0.7)),
    ...services.map((s) => at(`/services/${s.slug}`, 0.6)),
    ...projects.map((p) => at(`/projects/${p.slug}`, 0.5, p.date)),
    ...news.map((n) => at(`/news/${n.slug}`, 0.5, n.date)),
    ...brands.map((b) => at(`/brands/${b.slug}`, 0.5)),
    ...configurators.map((c) => at(`/configurators/${c.slug}`, 0.4)),
  ];
}
