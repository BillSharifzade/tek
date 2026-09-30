import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export function SectionHeader({
  title,
  href,
  linkLabel,
  right,
  className,
  as: Tag = "h2",
}: {
  title: React.ReactNode;
  href?: string;
  linkLabel?: string;
  right?: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-3", className)}>
      <Tag className={Tag === "h1" ? "text-3xl font-semibold" : "text-2xl font-semibold"}>{title}</Tag>
      {right}
      {href ? (
        <Link href={href} className="inline-flex items-center gap-1 text-base font-medium text-ink transition-colors hover:text-black">
          {linkLabel ?? "Все"}
          <ChevronRight className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Заголовок секции по центру + жёлтая кнопка под ним (лендинг: «Новинки» / «В каталог», «Реализованные проекты» / «Все проекты»).
 * Заголовок 28/22 bold, кнопка h44 r7 14/24 500 с полями 16px, зазор 23px.
 */
export function CenteredHeader({ title, href, cta, className }: { title: React.ReactNode; href: string; cta: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <h2 className="mt-px text-center text-[24px] font-bold leading-[22px] text-black sm:text-[28px]">{title}</h2>
      <Link
        href={href}
        className="mt-[22px] inline-flex h-[44px] items-center rounded-[7px] bg-brand px-[16px] text-[14px] font-medium leading-[24px] text-black transition-colors hover:bg-brand-hover"
      >
        {cta}
      </Link>
    </div>
  );
}

export function Section({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("container-page mt-14", className)}>
      {children}
    </section>
  );
}

export function Card({ children, className, padded = true }: { children: React.ReactNode; className?: string; padded?: boolean }) {
  return <div className={cn("rounded-[8px] border border-line bg-white", padded && "p-6", className)}>{children}</div>;
}
