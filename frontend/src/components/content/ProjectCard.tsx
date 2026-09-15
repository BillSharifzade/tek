import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ImageBox } from "@/components/ui/ImageBox";
import { imageOf, type ProjectItem } from "./types";

export function ProjectCard({ project }: { project: ProjectItem }) {
  const href = `/projects/${project.slug}`;
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[8px] border border-line bg-white transition-colors hover:border-brand">
      <Link href={href} className="relative block aspect-[16/10] w-full bg-surface" tabIndex={-1} aria-hidden>
        <ImageBox src={imageOf(project)} alt="" label={project.title} fit="cover" sizes="(max-width: 768px) 100vw, 400px" className="h-full w-full" rounded="rounded-none" />
        <span className="absolute left-3 top-3 inline-flex h-7 items-center rounded-full bg-brand px-3 text-sm font-semibold text-ink tnum">{project.year}</span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2">
          <Link href={href} className="group-hover:text-brand-hover">
            {project.title}
          </Link>
        </h3>
        <dl className="mt-3 grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-sub">Объект</dt>
          <dd className="font-medium">{project.object || "—"}</dd>
          <dt className="text-sub">Услуга</dt>
          <dd className="font-medium">{project.service || "—"}</dd>
        </dl>
        <Link href={href} className="mt-auto inline-flex items-center gap-1 pt-4 text-base font-medium hover:text-brand-hover">
          Подробнее
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </article>
  );
}
