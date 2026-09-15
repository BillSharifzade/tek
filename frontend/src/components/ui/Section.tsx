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
        <Link href={href} className="inline-flex items-center gap-1 text-base font-medium text-ink transition-colors hover:text-brand-hover">
          {linkLabel ?? "Все"}
          <ChevronRight className="size-4" />
        </Link>
      ) : null}
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
