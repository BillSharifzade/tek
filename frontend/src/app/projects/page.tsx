import type { Metadata } from "next";
import { publicGet } from "@/lib/server";
import { countLabel } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Pagination } from "@/components/ui/Pagination";
import { ProjectCard } from "@/components/content/ProjectCard";
import type { ContentPaged, ProjectItem } from "@/components/content/types";

export const metadata: Metadata = { title: "Реализованные проекты" };

const PER_PAGE = 12;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const data = await publicGet<ContentPaged<ProjectItem>>("/content/projects", { page, per_page: PER_PAGE }, 300);

  return (
    <div className="container-page pb-14">
      <Breadcrumbs items={[{ label: "Проекты" }]} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1>Реализованные проекты</h1>
        <p className="text-sub tnum">{countLabel(data.total, ["проект", "проекта", "проектов"])}</p>
      </div>
      <p className="mt-2 max-w-2xl text-sub">Электроснабжение банков, заводов, ГЭС, ЛЭП и жилых комплексов по всему Таджикистану — с 2017 года.</p>
      {data.items.length > 0 ? (
        <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((p) => (
            <li key={p.slug}>
              <ProjectCard project={p} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 rounded-[8px] border border-line bg-white p-8 text-center text-sub">Проекты пока не добавлены.</p>
      )}
      <Pagination page={data.page} pages={data.pages} hrefFor={(p) => (p === 1 ? "/projects" : `/projects?page=${p}`)} className="mt-10" />
    </div>
  );
}
