import "server-only";
import type { Brand } from "@/lib/types";
import { optional, publicGet, safe } from "@/lib/server";
import { projectBrands, type BrandLite, type ProjectDetail } from "./model";

interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

const TTL = 300;

/** Все проекты (API отдаёт максимум 100 на страницу). */
export async function fetchAllProjects(): Promise<ProjectDetail[]> {
  const first = await publicGet<Paged<ProjectDetail>>("/content/projects", { page: 1, per_page: 100 }, TTL);
  if (first.pages <= 1) return first.items;
  const rest = await Promise.all(
    Array.from({ length: first.pages - 1 }, (_, i) => publicGet<Paged<ProjectDetail>>("/content/projects", { page: i + 2, per_page: 100 }, TTL)),
  );
  return [first, ...rest].flatMap((p) => p.items);
}

export function fetchProject(slug: string): Promise<ProjectDetail | null> {
  return optional(publicGet<ProjectDetail>(`/content/projects/${encodeURIComponent(slug)}`, undefined, TTL));
}

export async function fetchBrandCatalog(): Promise<BrandLite[]> {
  const brands = await safe(publicGet<Brand[]>("/brands", undefined, TTL), []);
  return brands.map((b) => ({ slug: b.slug, name: b.name, logo: b.logo }));
}

/**
 * Проекты + их бренды. Список `/content/projects` брендов не содержит, поэтому (пока бэкенд не добавит `brands`)
 * бренды извлекаются из описания каждого проекта (детальные ответы кешируются на 5 минут).
 */
export async function fetchProjectsWithBrands(): Promise<{ projects: ProjectDetail[]; brandsOf: Map<string, BrandLite[]>; catalog: BrandLite[] }> {
  const [projects, catalog] = await Promise.all([fetchAllProjects(), fetchBrandCatalog()]);
  const needDetails = projects.some((p) => !p.brands);
  const detailed = needDetails
    ? await Promise.all(projects.map(async (p) => (p.brands ? p : ((await safe(fetchProject(p.slug), null)) ?? p))))
    : projects;
  const brandsOf = new Map<string, BrandLite[]>();
  for (const p of detailed) brandsOf.set(p.slug, projectBrands(p, catalog));
  return { projects, brandsOf, catalog };
}
