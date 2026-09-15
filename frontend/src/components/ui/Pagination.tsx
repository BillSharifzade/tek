import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export interface PaginationProps {
  page: number;
  pages: number;
  /** returns href for a given page */
  hrefFor: (page: number) => string;
  className?: string;
}

function range(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set<number>([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => set.add(p));
  if (page >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((p) => set.add(p));
  const sorted = [...set].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("…");
    out.push(sorted[i]);
  }
  return out;
}

export function Pagination({ page, pages, hrefFor, className }: PaginationProps) {
  if (pages <= 1) return null;
  const item = "inline-flex h-10 min-w-10 items-center justify-center rounded-[6px] border px-3 text-base transition-colors";
  return (
    <nav aria-label="Пагинация" className={cn("flex flex-wrap items-center justify-center gap-1.5", className)}>
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(item, "border-line bg-white hover:border-muted")} aria-label="Предыдущая страница">
          <ChevronLeft className="size-4" />
        </Link>
      ) : (
        <span className={cn(item, "border-line text-muted")}>
          <ChevronLeft className="size-4" />
        </span>
      )}
      {range(page, pages).map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 text-sub">
            …
          </span>
        ) : p === page ? (
          <span key={p} aria-current="page" className={cn(item, "border-brand bg-brand font-semibold")}>
            {p}
          </span>
        ) : (
          <Link key={p} href={hrefFor(p)} className={cn(item, "border-line bg-white hover:border-muted")}>
            {p}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={cn(item, "border-line bg-white hover:border-muted")} aria-label="Следующая страница">
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className={cn(item, "border-line text-muted")}>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
