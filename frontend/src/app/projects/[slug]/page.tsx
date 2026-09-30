import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { safe } from "@/lib/server";
import { fetchAllProjects, fetchBrandCatalog, fetchProject } from "@/components/projects/fetch";
import { projectImage } from "@/components/projects/model";
import { ProjectView } from "@/components/projects/ProjectView";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const p = await safe(fetchProject(slug), null);
  if (!p) return { title: "Проект" };
  const image = projectImage(p);
  const description = p.excerpt || [p.object && `Объект: ${p.object}`, p.service && `Работы: ${p.service}`, p.year].filter(Boolean).join(". ");
  return { title: p.title, description, openGraph: { title: p.title, description, images: image ? [image] : undefined } };
}

export default async function ProjectPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [project, catalog, all] = await Promise.all([fetchProject(slug), fetchBrandCatalog(), safe(fetchAllProjects(), [])]);
  if (!project) notFound();
  return <ProjectView project={project} catalog={catalog} all={all} />;
}
