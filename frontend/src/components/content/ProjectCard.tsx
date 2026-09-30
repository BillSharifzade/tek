import Link from "next/link";
import { ImageBox } from "@/components/ui/ImageBox";
import { cn } from "@/lib/cn";
import { projectImage, serviceTags, type ProjectLike } from "@/components/projects/model";

/**
 * Карточка проекта 1:1 с компонентом Figma «Group 1» (10554:312) — страница «Проекты» и блок лендинга.
 * 397×475: фото 397×256 (r10 сверху) → пилюли услуг → заголовок в 2 строки → «Объект: …» → год + «Подробнее ›».
 * Принимает любой проект из API: `Project`, `HomeProject` (home.projects) или `ProjectItem`.
 */

// Ширины пилюль из макета (центрированный текст 13/18); для остальных услуг — поля 10.5px.
const TAG_WIDTH: Record<string, number> = { Поставка: 80, "Пуско-наладка": 109, Монтаж: 73 };

function IconChevron(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden {...props}>
      <path
        d="M3.44077 2.20551C3.62323 2.03005 3.91327 2.03583 4.0886 2.21843L7.70005 5.97958L4.08411 9.64138C3.90624 9.82149 3.61615 9.82323 3.43617 9.64523C3.25618 9.46723 3.25447 9.17689 3.43233 8.99678L6.42056 5.97059L3.42787 2.85384C3.25254 2.67125 3.25832 2.38098 3.44077 2.20551Z"
        fill="currentColor"
      />
    </svg>
  );
}

export interface ProjectCardProps {
  project: ProjectLike;
  className?: string;
  /** первые карточки на экране — грузить фото сразу */
  priority?: boolean;
  /** куда ведут пилюли услуг; по умолчанию — фильтр на странице «Проекты» */
  tagHref?: (tag: string) => string;
}

export function projectTagHref(tag: string): string {
  return `/projects?service=${encodeURIComponent(tag)}`;
}

/** Пилюли услуг «Поставка / Пуско-наладка / Монтаж»: 24px, r15, #EEF0F2 (на серой плашке — белые). */
export function ProjectTags({ tags, tagHref = projectTagHref, tone = "grey", className }: { tags: string[]; tagHref?: (tag: string) => string; tone?: "grey" | "white"; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-[9px]", className)} aria-label="Услуги">
      {tags.map((t) => (
        <li key={t}>
          <Link
            href={tagHref(t)}
            style={TAG_WIDTH[t] ? { width: TAG_WIDTH[t] } : undefined}
            className={cn(
              "block h-[24px] whitespace-nowrap rounded-[15px] px-[10.5px] pt-[3px] text-center text-[13px] leading-[18px] text-g333 transition-colors hover:bg-btn-hover hover:text-black",
              tone === "white" ? "bg-white" : "bg-btn",
            )}
          >
            {t}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ProjectCard({ project, className, priority, tagHref = projectTagHref }: ProjectCardProps) {
  const href = `/projects/${project.slug}`;
  const tags = serviceTags(project.service);
  return (
    <article className={cn("group/pc flex h-full min-h-[475px] flex-col rounded-[10px] bg-white transition-shadow duration-200 hover:shadow-card", className)}>
      <Link href={href} tabIndex={-1} aria-hidden className="block h-[256px] shrink-0 overflow-hidden rounded-t-[10px]">
        <ImageBox
          src={projectImage(project)}
          alt=""
          label={project.title}
          fit="cover"
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 397px"
          className="h-full w-full"
          rounded="rounded-none"
        />
      </Link>
      <div className="flex flex-1 flex-col pl-[27px] pr-[25px] pb-[29px]">
        {tags.length > 0 ? <ProjectTags tags={tags} tagHref={tagHref} className="mt-[18px]" /> : <div className="mt-[18px] h-[24px]" aria-hidden />}
        <h3 className="mt-[17px] min-h-[48px] max-w-[342px] text-[18px] font-semibold leading-[24px] text-g333">
          <Link href={href} className="line-clamp-2 link-hover">
            {project.title}
          </Link>
        </h3>
        {project.object ? <p className="mt-[14px] line-clamp-2 text-[14px] leading-[17px] text-sub">Объект: {project.object}</p> : null}
        <div className="mt-auto flex items-start justify-between gap-4 pt-[35px]">
          <span className="text-[13px] leading-[17px] text-muted tnum">{project.year}</span>
          <Link href={href} className="mt-[3px] inline-flex items-start gap-[4px] text-[14px] leading-[12px] text-g333 link-hover">
            <span className="underline decoration-1">Подробнее</span>
            <IconChevron className="mt-px shrink-0" />
          </Link>
        </div>
      </div>
    </article>
  );
}
