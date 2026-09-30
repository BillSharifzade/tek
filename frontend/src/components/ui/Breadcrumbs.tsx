import Link from "next/link";
import { Fragment } from "react";
import { cn } from "@/lib/cn";

export interface CrumbItem {
  href?: string;
  label: string;
}

/**
 * Хлебные крошки как в макете: «Главная   >   Раздел», 14/15 #808080, разделитель «>» с тремя пробелами.
 * (В Figma — TT Commons Pro Trial; trial-шрифт нельзя использовать на сайте, поэтому Roboto того же кегля.)
 */
export function Breadcrumbs({ items, separator = ">", className }: { items: CrumbItem[]; separator?: ">" | "/"; className?: string }) {
  const all: CrumbItem[] = [{ href: "/", label: "Главная" }, ...items];
  return (
    <nav aria-label="Хлебные крошки" className={cn("text-[14px] leading-[15px] text-muted", className)}>
      <ol className="flex flex-wrap items-center gap-y-1">
        {all.map((c, i) => {
          const last = i === all.length - 1;
          return (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 ? (
                <li aria-hidden className="px-[11px]">
                  {separator}
                </li>
              ) : null}
              <li>
                {c.href && !last ? (
                  <Link href={c.href} className="link-hover">
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
