import Link from "next/link";
import type { Metadata } from "next";
import { ProjectCard } from "@/components/content/ProjectCard";
import { ProjectFilters, type FilterGroup, type FilterOption } from "@/components/projects/ProjectFilters";
import { fetchProjectsWithBrands } from "@/components/projects/fetch";
import { serviceTags, type ProjectDetail } from "@/components/projects/model";

export const metadata: Metadata = {
  title: "Выполненные проекты",
  description: "Проекты ТЭК: поставка, пуско-наладка и монтаж электрооборудования на объектах Таджикистана.",
};

const PER_PAGE = 12;

type SP = Promise<{ brand?: string | string[]; product?: string | string[]; service?: string | string[]; page?: string | string[] }>;

const one = (v: string | string[] | undefined): string | null => (Array.isArray(v) ? v[0] : v) || null;

/** Опции фильтра с учётом второго фильтра (как в каталоге: счётчики по уже отфильтрованному списку). */
function countOptions(list: ProjectDetail[], values: (p: ProjectDetail) => string[], labels: Map<string, string>, order: string[], active: string | null): FilterOption[] {
  const counts = new Map<string, number>();
  for (const p of list) for (const v of values(p)) counts.set(v, (counts.get(v) ?? 0) + 1);
  return order.filter((v) => counts.has(v) || v === active).map((v) => ({ value: v, label: labels.get(v) ?? v, count: counts.get(v) ?? 0 }));
}

export default async function ProjectsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { projects, brandsOf, catalog } = await fetchProjectsWithBrands();

  const brandSlugs = (p: ProjectDetail) => (brandsOf.get(p.slug) ?? []).map((b) => b.slug).filter(Boolean);
  const services = (p: ProjectDetail) => serviceTags(p.service);
  const productCats = (p: ProjectDetail) => (p.categories ?? []).map((c) => c.slug);

  // Варианты — только те, что реально встречаются в проектах (порядок брендов — как в каталоге брендов).
  const brandLabels = new Map(catalog.map((b) => [b.slug, b.name]));
  const brandOrder = catalog.map((b) => b.slug).filter((s) => projects.some((p) => brandSlugs(p).includes(s)));
  const serviceOrder: string[] = [];
  for (const p of projects) for (const s of services(p)) if (!serviceOrder.includes(s)) serviceOrder.push(s);
  const serviceRank = serviceTags(serviceOrder.join(","));
  const productLabels = new Map<string, string>();
  for (const p of projects) for (const c of p.categories ?? []) productLabels.set(c.slug, c.name);
  const productOrder = [...productLabels.keys()];

  const brandParam = one(sp.brand);
  const productParam = one(sp.product);
  const serviceParam = one(sp.service);
  const brand = brandParam && brandOrder.includes(brandParam) ? brandParam : null;
  const product = productParam && productOrder.includes(productParam) ? productParam : null;
  const service = serviceParam && serviceRank.includes(serviceParam) ? serviceParam : null;

  // каждый фильтр считает варианты по списку, отфильтрованному остальными (как в каталоге)
  const match = (p: ProjectDetail, skip: "brand" | "product" | null) =>
    (skip === "brand" || !brand || brandSlugs(p).includes(brand)) &&
    (skip === "product" || !product || productCats(p).includes(product)) &&
    (!service || services(p).includes(service));
  const filtered = projects.filter((p) => match(p, null));

  const groups: FilterGroup[] = [
    { param: "brand", title: "Вендоры", active: brand, options: countOptions(projects.filter((p) => match(p, "brand")), brandSlugs, brandLabels, brandOrder, brand) },
    { param: "product", title: "Продукция", active: product, options: countOptions(projects.filter((p) => match(p, "product")), productCats, productLabels, productOrder, product) },
  ];

  const hrefWith = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const next = { brand, product, service, ...patch };
    if (next.brand) q.set("brand", next.brand);
    if (next.product) q.set("product", next.product);
    if (next.service) q.set("service", next.service);
    if (patch.page) q.set("page", patch.page);
    const s = q.toString();
    return s ? `/projects?${s}` : "/projects";
  };

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const shown = Math.min(pages, Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1));
  const visible = filtered.slice(0, shown * PER_PAGE);
  const left = filtered.length - visible.length;

  return (
    <div className="bg-surface">
      <div className="container-page pb-[70px] min-[1292px]:pl-[17px]">
        <h1 className="pt-[40px] text-[28px] font-bold leading-[32px] text-black md:pt-[50px] md:text-[35px] md:leading-[12px]">Выполненные проекты</h1>

        <div className="mt-[28px] md:mt-[45px]">
          <ProjectFilters groups={groups} hrefFor={(param, value) => hrefWith({ [param]: value })} />
        </div>

        {service ? (
          <p className="mt-[20px] flex items-center gap-[10px] text-[14px] leading-[20px] text-sub">
            Услуга: <span className="rounded-[15px] bg-btn px-[12px] py-[4px] text-[13px] leading-[17px] text-black">{service}</span>
            <Link href={hrefWith({ service: null })} scroll={false} className="text-link link-hover">
              сбросить
            </Link>
          </p>
        ) : null}

        {visible.length > 0 ? (
          <ul className="mt-[32px] grid grid-cols-1 gap-x-[34px] gap-y-[32px] sm:grid-cols-2 md:mt-[45px] lg:grid-cols-3 lg:gap-y-[52px]">
            {visible.map((p, i) => (
              <li key={p.slug}>
                <ProjectCard project={p} priority={i < 3} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-[45px] rounded-[10px] bg-white px-6 py-12 text-center">
            <p className="text-[16px] font-semibold leading-[20px]">Проектов с такими параметрами пока нет</p>
            <Link href="/projects" scroll={false} className="mt-[16px] inline-block h-[44px] rounded-[7px] bg-brand px-[16px] pt-[10px] text-[14px] font-medium leading-[24px] transition-colors hover:bg-brand-hover">
              Сбросить фильтры
            </Link>
          </div>
        )}

        {left > 0 ? (
          <div className="mt-[52px] flex justify-center">
            <Link
              href={hrefWith({ page: String(shown + 1) })}
              scroll={false}
              className="h-[44px] rounded-[7px] bg-brand px-[16px] pt-[10px] text-[14px] font-medium leading-[24px] text-black transition-colors hover:bg-brand-hover"
            >
              Показать ещё {Math.min(left, PER_PAGE)}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
