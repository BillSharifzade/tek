"use client";

import Link from "next/link";
import { ChevronRight, LayoutGrid, X } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CategoryNode } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useEscape, useHydrated, useLockBody } from "@/lib/hooks";
import { ImageBox } from "@/components/ui/ImageBox";
import { countLabel } from "@/lib/format";

export function CatalogMenuButton({ categories, compact }: { categories: CategoryNode[]; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "inline-flex shrink-0 items-center gap-2 rounded-[6px] bg-brand font-semibold text-ink transition-colors hover:bg-brand-hover",
          compact ? "h-10 px-4" : "h-11 px-5",
        )}
      >
        <span className="relative block size-4" aria-hidden>
          <span className={cn("absolute left-0 top-0.5 h-0.5 w-4 rounded bg-ink transition-transform", open && "translate-y-[6px] rotate-45")} />
          <span className={cn("absolute left-0 top-[7px] h-0.5 w-4 rounded bg-ink transition-opacity", open && "opacity-0")} />
          <span className={cn("absolute left-0 top-3 h-0.5 w-4 rounded bg-ink transition-transform", open && "-translate-y-[6px] -rotate-45")} />
        </span>
        Каталог
      </button>
      <CatalogMenu open={open} onClose={() => setOpen(false)} categories={categories} />
    </>
  );
}

export function CatalogMenu({ open, onClose, categories }: { open: boolean; onClose: () => void; categories: CategoryNode[] }) {
  const hydrated = useHydrated();
  const [active, setActive] = useState<string>(categories[0]?.slug ?? "");
  const ref = useRef<HTMLDivElement>(null);
  useEscape(onClose, open);
  useLockBody(open);

  if (!hydrated || !open) return null;
  const current = categories.find((c) => c.slug === active) ?? categories[0];

  return createPortal(
    <div className="fixed inset-0 z-[90] animate-fade-in" role="presentation">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-label="Каталог товаров"
        className="absolute left-0 right-0 top-0 bg-white shadow-pop"
        style={{ top: "var(--header-offset, 116px)" }}
      >
        <div className="container-page">
          <div className="grid max-h-[calc(100vh-140px)] grid-cols-1 md:grid-cols-[300px_1fr]">
            <ul className="overflow-y-auto border-r border-line py-3" role="menu">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/catalog/${c.slug}`}
                    onClick={onClose}
                    onMouseEnter={() => setActive(c.slug)}
                    onFocus={() => setActive(c.slug)}
                    className={cn(
                      "flex items-center justify-between gap-3 px-4 py-2.5 text-base transition-colors",
                      active === c.slug ? "bg-brand-light font-medium" : "hover:bg-surface",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <LayoutGrid className="size-4 text-sub" />
                      {c.name}
                    </span>
                    <ChevronRight className="size-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-y-auto p-6 md:block">
              {current ? (
                <>
                  <div className="mb-5 flex items-center justify-between">
                    <Link href={`/catalog/${current.slug}`} onClick={onClose} className="text-2xl font-semibold hover:text-sub">
                      {current.name}
                    </Link>
                    <span className="text-sm text-sub">{countLabel(current.product_count, ["товар", "товара", "товаров"])}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-3">
                    {current.children.map((sub) => (
                      <div key={sub.slug}>
                        <Link href={`/catalog/${sub.slug}`} onClick={onClose} className="group flex items-start gap-3 rounded-[8px] border border-line p-3 transition-colors hover:border-brand">
                          <ImageBox src={sub.image} alt="" label={sub.name} className="size-12 shrink-0 bg-surface" sizes="48px" rounded="rounded-[6px]" />
                          <span className="min-w-0">
                            <span className="block text-base font-semibold leading-5 group-hover:text-brand-hover">{sub.name}</span>
                            <span className="mt-0.5 block text-xs text-sub">{countLabel(sub.product_count, ["товар", "товара", "товаров"])}</span>
                          </span>
                        </Link>
                        {sub.children.length > 0 ? (
                          <ul className="mt-2 flex flex-col gap-1.5 pl-1">
                            {sub.children.slice(0, 6).map((s3) => (
                              <li key={s3.slug}>
                                <Link href={`/catalog/${s3.slug}`} onClick={onClose} className="text-sm text-sub hover:text-ink">
                                  {s3.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Закрыть" className="absolute right-4 top-4 rounded p-1 text-sub hover:bg-surface md:hidden">
          <X className="size-5" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
