import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CalendarDays, Wrench } from "lucide-react";
import { optional, publicGet } from "@/lib/server";
import { date } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Prose } from "@/components/content/Prose";
import { ContentHero } from "@/components/content/ContentHero";
import { CtaBand } from "@/components/content/CtaBand";
import { imageOf, type ProjectItem } from "@/components/content/types";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const p = await optional(publicGet<ProjectItem>(`/content/projects/${slug}`, undefined, 300));
  return { title: p?.title ?? "Проект" };
}

export default async function ProjectPage({ params }: { params: Params }) {
  const { slug } = await params;
  const project = await optional(publicGet<ProjectItem>(`/content/projects/${slug}`, undefined, 300));
  if (!project) notFound();

  const meta = [
    { icon: CalendarDays, label: "Год", value: project.year, extra: project.date ? date(project.date) : null },
    { icon: Building2, label: "Объект", value: project.object || "—", extra: null },
    { icon: Wrench, label: "Услуга", value: project.service || "—", extra: null },
  ];

  return (
    <div className="container-page pb-14">
      <Breadcrumbs items={[{ href: "/projects", label: "Проекты" }, { label: project.title }]} />
      <h1 className="max-w-4xl">{project.title}</h1>
      <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {meta.map((m) => (
          <div key={m.label} className="flex items-start gap-3 rounded-[8px] border border-line bg-white px-4 py-3">
            <m.icon className="mt-0.5 size-5 shrink-0 text-brand-hover" aria-hidden />
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-sub">{m.label}</dt>
              <dd className="text-base font-semibold">
                {m.value}
                {m.extra ? <span className="ml-2 text-sm font-normal text-sub tnum">{m.extra}</span> : null}
              </dd>
            </div>
          </div>
        ))}
      </dl>
      <ContentHero src={imageOf(project)} alt={project.title} className="mt-6" />
      <div className="mt-8 max-w-3xl">{project.body ? <Prose html={project.body} /> : project.excerpt ? <p className="text-md">{project.excerpt}</p> : null}</div>
      <Link href="/projects" className="mt-8 inline-flex items-center gap-2 text-base font-medium hover:text-brand-hover">
        <ArrowLeft className="size-4" />
        Все проекты
      </Link>
      <CtaBand className="mt-14" title="Планируете похожий объект?" text="Подготовим спецификацию, подберём оборудование и выполним поставку с пуско-наладкой." />
    </div>
  );
}
