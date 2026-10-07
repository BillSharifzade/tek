import Link from "next/link";
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

function Arrow({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg width={7} height={12} viewBox="0 0 7 12" fill="none" aria-hidden className={dir === "prev" ? "rotate-180" : undefined}>
      <path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Пагинация в языке макета (как сегмент-кнопки сортировки каталога): h=32, r=5, Regular 13,
 * серые по палитре ТЗ #EEF0F2 (hover #D9DDE3), текущая — жёлтая #FFCC33.
 */
export function Pagination({ page, pages, hrefFor, className }: PaginationProps) {
  if (pages <= 1) return null;
  const item = "inline-flex h-[32px] min-w-[32px] items-center justify-center rounded-[5px] px-[10px] text-[13px] leading-[12px] text-black transition-colors tnum";
  const idle = "bg-btn hover:bg-btn-hover";
  return (
    <nav aria-label="Пагинация" className={cn("flex flex-wrap items-center justify-center gap-[4px]", className)}>
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(item, idle)} aria-label="Предыдущая страница">
          <Arrow dir="prev" />
        </Link>
      ) : (
        <span className={cn(item, "bg-btn text-muted opacity-60")} aria-hidden>
          <Arrow dir="prev" />
        </span>
      )}
      {range(page, pages).map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-[6px] text-[13px] text-muted">
            …
          </span>
        ) : p === page ? (
          <span key={p} aria-current="page" className={cn(item, "bg-brand font-medium")}>
            {p}
          </span>
        ) : (
          <Link key={p} href={hrefFor(p)} className={cn(item, idle)}>
            {p}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={cn(item, idle)} aria-label="Следующая страница">
          <Arrow dir="next" />
        </Link>
      ) : (
        <span className={cn(item, "bg-btn text-muted opacity-60")} aria-hidden>
          <Arrow dir="next" />
        </span>
      )}
    </nav>
  );
}
