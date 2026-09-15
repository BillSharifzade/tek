import Link from "next/link";
import { Fragment } from "react";
import { cn } from "@/lib/cn";

export interface CrumbItem {
  href?: string;
  label: string;
}

export function Breadcrumbs({ items, separator = ">", className }: { items: CrumbItem[]; separator?: ">" | "/"; className?: string }) {
  const all: CrumbItem[] = [{ href: "/", label: "Главная" }, ...items];
  return (
    <nav aria-label="Хлебные крошки" className={cn("py-4 text-sm text-sub", className)}>
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {all.map((c, i) => {
          const last = i === all.length - 1;
          return (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 ? (
                <li aria-hidden className="text-muted">
                  {separator}
                </li>
              ) : null}
              <li className={cn(last && "text-ink")}>
                {c.href && !last ? (
                  <Link href={c.href} className="hover:text-ink transition-colors">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined}>{c.label}</span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
