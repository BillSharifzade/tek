import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { ProjectCard, ProjectTags } from "@/components/content/ProjectCard";
import { brandLogo } from "@/components/content/brands";
import { ImageBox } from "@/components/ui/ImageBox";
import { cn } from "@/lib/cn";
import type { BrandLite, ProjectDetail } from "./model";

/**
 * Страница проекта (макета нет — «на усмотрение разраба»). Собрана из элементов макета:
 * герой как в «Сервис центр ДГУ» (10869:2979: плашка #F7F8F9 r11 1260×475 + фото 572px справа, кнопки 54px r7),
 * карточка-список как «Мощность генератора» (белая r10, тень 0 2 8 2 /10%, строки 41px с линией #B3BAC7),
 * блок «Другие проекты» как «Реализованные проекты» лендинга (10999:2888: фон #F6F7F8, заголовок 28 по центру).
 */

export function ProjectHero({ project, image, facts, actions }: { project: ProjectDetail; image: string | null; facts: ReactNode; actions?: ReactNode }) {
  return (
    <section className="grid overflow-hidden rounded-[11px] bg-surface-2 lg:min-h-[475px] lg:grid-cols-[minmax(0,1fr)_572px]">
      <div className="order-2 px-[20px] pb-[28px] pt-[24px] sm:px-[40px] lg:order-1 lg:pb-[56px] lg:pl-[63px] lg:pr-[56px] lg:pt-[56px]">
        <h1 className="text-[26px] font-bold leading-[32px] text-black md:text-[32px] md:leading-[40px]">{project.title}</h1>
        <div className="mt-[20px] md:mt-[26px]">{facts}</div>
        {actions ? <div className="mt-[28px] flex flex-wrap gap-[12px] md:mt-[34px]">{actions}</div> : null}
      </div>
      <div className="relative order-1 h-[240px] sm:h-[340px] lg:order-2 lg:h-auto">
        <ImageBox src={image} alt={project.title} label={project.title} fit="cover" priority sizes="(max-width: 1024px) 100vw, 572px" className="absolute inset-0 h-full w-full" rounded="rounded-none" />
      </div>
    </section>
  );
}

/** «Краткие данные»: подпись 16 #666 слева, значение 16/600 #333; строки 41px, разделитель #D9DDE4. */
export function FactList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line-3 border-y border-line-3">
      {items.map((f) => (
        <div key={f.label} className="grid grid-cols-[96px_minmax(0,1fr)] items-baseline gap-x-[16px] py-[10px] sm:grid-cols-[120px_minmax(0,1fr)]">
          <dt className="text-[15px] leading-[21px] text-sub md:text-[16px]">{f.label}</dt>
          <dd className="text-[15px] font-semibold leading-[21px] text-g333 md:text-[16px]">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ServiceFact({ tags }: { tags: string[] }) {
  return <ProjectTags tags={tags} tone="white" className="-my-[1px] font-normal" />;
}

export function BrandLinks({ brands }: { brands: BrandLite[] }) {
  return (
    <span>
      {brands.map((b, i) => (
        <span key={b.slug || b.name}>
          {i > 0 ? ", " : null}
          {b.slug ? (
            <Link href={`/brands/${b.slug}`} className="link-hover underline decoration-[#B3BAC7] underline-offset-[3px] hover:decoration-black">
              {b.name}
            </Link>
          ) : (
            b.name
          )}
        </span>
      ))}
    </span>
  );
}

/** Заголовок секции страницы: Roboto 700 26/30 (как «Техническое обслуживание» в 10869:2975). */
export function SectionHeading({ children, id, className }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <h2 id={id} className={cn("scroll-mt-[140px] text-[22px] font-bold leading-[28px] text-black md:text-[26px] md:leading-[30px]", className)}>
      {children}
    </h2>
  );
}

/** Белая карточка с тенью как «Мощность генератора» (417px, поля 34). */
export function AsideCard({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[10px] bg-white px-[24px] pb-[28px] pt-[26px] shadow-card md:px-[34px] md:pb-[34px] md:pt-[30px]", className)}>
      <h2 className="text-[16px] font-semibold leading-[20px] text-g333">{title}</h2>
      {children}
    </section>
  );
}

/** Логотипы брендов проекта → страницы брендов. */
export function BrandTiles({ brands }: { brands: BrandLite[] }) {
  return (
    <ul className="mt-[18px] grid grid-cols-2 gap-[10px]">
      {brands.map((b) => {
        const logo = brandLogo({ slug: b.slug, logo: b.logo });
        const tile = (
          <>
            <span className="relative block h-[40px] w-full">
              {logo ? (
                <Image src={logo} alt={b.name} fill unoptimized sizes="150px" className="object-contain mix-blend-multiply" />
              ) : (
                <span className="flex h-full items-center justify-center text-[16px] font-bold">{b.name}</span>
              )}
            </span>
            <span className="mt-[8px] block truncate text-center text-[13px] leading-[18px] text-sub">{b.name}</span>
          </>
        );
        return (
          <li key={b.slug || b.name}>
            {b.slug ? (
              <Link href={`/brands/${b.slug}`} className="block rounded-[7px] bg-surface-2 px-[14px] pb-[10px] pt-[14px] transition-colors hover:bg-btn">
                {tile}
              </Link>
            ) : (
              <div className="rounded-[7px] bg-surface-2 px-[14px] pb-[10px] pt-[14px]">{tile}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── Видео ───────────────────────────────────────────────────────────────────────────────────

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{6,})/);
      return m ? m[1] : null;
    }
  } catch {
    /* not a URL */
  }
  return null;
}

export function ProjectVideo({ url, title }: { url: string; title: string }) {
  const id = youtubeId(url);
  if (!id) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-[54px] items-center rounded-[7px] bg-brand px-[24px] text-[16px] font-medium leading-[24px] transition-colors hover:bg-brand-hover">
        Смотреть видео
      </a>
    );
  }
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[10px] bg-black">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`}
        title={`Видео: ${title}`}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}

export function PhotoGrid({ photos, title }: { photos: string[]; title: string }) {
  return (
    <ul className="grid grid-cols-2 gap-[12px] md:grid-cols-3 md:gap-[20px]">
      {photos.map((src, i) => (
        <li key={src}>
          <a href={src} target="_blank" rel="noopener noreferrer" className="block h-[140px] overflow-hidden rounded-[10px] transition-opacity hover:opacity-90 md:h-[200px]">
            <ImageBox src={src} alt={`${title} — фото ${i + 1}`} fit="cover" sizes="(max-width: 768px) 50vw, 280px" className="h-full w-full" rounded="rounded-none" />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** «Другие проекты» — повтор блока «Реализованные проекты» с лендинга: фон #F6F7F8, 28/22 по центру, кнопка 44px, карточки 397. */
export function OtherProjects({ projects }: { projects: ProjectDetail[] }) {
  if (projects.length === 0) return null;
  return (
    <section className="bg-surface pb-[64px] pt-[44px] md:pb-[87px] md:pt-[52px]">
      <div className="container-page">
        <h2 className="text-center text-[24px] font-bold leading-[28px] text-black md:text-[28px] md:leading-[22px]">Другие проекты</h2>
        <div className="mt-[20px] flex justify-center md:mt-[23px]">
          <Link href="/projects" className="h-[44px] rounded-[7px] bg-brand px-[16px] pt-[10px] text-[14px] font-medium leading-[24px] text-black transition-colors hover:bg-brand-hover">
            Все проекты
          </Link>
        </div>
        <ul className="mt-[32px] grid grid-cols-1 gap-[34px] sm:grid-cols-2 md:mt-[44px] lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.slug}>
              <ProjectCard project={p} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
