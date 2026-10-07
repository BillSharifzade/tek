"use client";

import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CategoryNode } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useEscape, useHydrated, useLockBody } from "@/lib/hooks";
import { ImageBox } from "@/components/ui/ImageBox";
import { countLabel } from "@/lib/format";
import { SITE, TOP_NAV } from "@/lib/site";

/**
 * Figma «Group 43»: 107×44, #FFCC33, r5; три линии 10.5px (stroke 1.3) + «Каталог» 14/12 Medium.
 * Линии в рендере макета лежат на y 16.7–18.0 / 21.7–23.0 / 26.7–28.0 от верха кнопки (обводка над осью линии).
 */
export function CatalogMenuButton({ categories }: { categories: CategoryNode[] }) {
  // меню открыто «на странице», где его открыли: переход по ссылке из шапки (логотип, поиск, корзина) его закрывает
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;

  // высота шапки (разная на телефоне / планшете / десктопе) — слой меню начинается сразу под ней
  useEffect(() => {
    const header = document.getElementById("site-header");
    if (!header) return;
    const apply = () => document.documentElement.style.setProperty("--header-h", `${Math.round(header.getBoundingClientRect().height)}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenAt((p) => (p === pathname ? null : pathname))}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative block h-[44px] w-[107px] shrink-0 rounded-[5px] bg-brand text-left text-black transition-colors hover:bg-brand-hover"
      >
        <span aria-hidden className="absolute left-[17px] top-[16.7px] block h-[11.3px] w-[10.5px]">
          {open ? (
            // классический крест высотой с заглавную «К» (10px): две линии по диагонали квадрата 10×10
            <>
              <span className="absolute left-1/2 top-1/2 h-[1.3px] w-[14.1px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-black" />
              <span className="absolute left-1/2 top-1/2 h-[1.3px] w-[14.1px] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-black" />
            </>
          ) : (
            <>
              <span className="absolute left-0 top-0 h-[1.3px] w-full bg-black" />
              <span className="absolute left-0 top-[5px] h-[1.3px] w-full bg-black" />
              <span className="absolute left-0 top-[10px] h-[1.3px] w-full bg-black" />
            </>
          )}
        </span>
        <span className="absolute left-[35.2px] top-[16px] text-[14px] font-medium leading-[12px]">Каталог</span>
      </button>
      <CatalogMenu open={open} onClose={() => setOpenAt(null)} categories={categories} />
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

  // слой начинается под шапкой: кнопка «Каталог» остаётся доступной и повторным кликом сворачивает меню
  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-[90] animate-fade-in" style={{ top: "var(--header-h, 114px)" }} role="presentation">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-label="Каталог товаров" className="absolute left-0 right-0 top-0 bg-white shadow-pop">
        <div className="container-page">
          <div className="grid max-h-[calc(100vh-140px)] grid-cols-1 overflow-y-auto md:grid-cols-[300px_1fr] md:overflow-visible">
            <ul className="overflow-y-auto border-r border-line pb-3 pt-12 md:pt-3" role="menu">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/catalog/${c.slug}`}
                    onClick={onClose}
                    onMouseEnter={() => setActive(c.slug)}
                    onFocus={() => setActive(c.slug)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-[6px] px-4 py-[10px] text-[14px] leading-[18px] transition-colors",
                      active === c.slug ? "bg-surface font-medium text-black" : "text-g333 hover:bg-surface",
                    )}
                  >
                    <span className="flex items-center gap-3">
                                            {c.name}
                    </span>
                    <ChevronRight className="size-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
            {/* на телефоне верхнего меню нет — разделы сайта и телефон здесь же, под каталогом */}
            <nav aria-label="Разделы сайта" className="border-t border-line px-4 pb-5 pt-4 md:hidden">
              <ul className="grid grid-cols-2 gap-x-4 gap-y-[10px] text-[14px] leading-[18px]">
                {/* пункты-ссылки с подменю (Услуги) — сами тоже в списке */}
                {TOP_NAV.flatMap((item) => (item.children?.length ? (item.clickable ? [{ href: item.href, label: `Все ${item.label.toLowerCase()}` }, ...item.children] : item.children) : [item])).filter((l, i, all) => all.findIndex((x) => x.href === l.href) === i).map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} onClick={onClose} className="text-g333 hover:text-black">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <a href={SITE.phoneHref} className="mt-4 inline-flex text-[15px] font-medium text-black">
                {SITE.phone}
              </a>
            </nav>
            <div className="hidden overflow-y-auto p-6 md:block">
              {current ? (
                <>
                  <div className="mb-5 flex items-center justify-between">
                    <Link href={`/catalog/${current.slug}`} onClick={onClose} className="text-[20px] font-bold leading-[24px] hover:text-black">
                      {current.name}
                    </Link>
                    <span className="text-sm text-sub">{countLabel(current.product_count, ["товар", "товара", "товаров"])}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-3">
                    {current.children.map((sub) => (
                      <div key={sub.slug}>
                        <Link href={`/catalog/${sub.slug}`} onClick={onClose} className="group flex items-start gap-3 rounded-[10px] bg-surface p-3 transition-colors hover:bg-btn">
                          <ImageBox src={sub.image} alt="" label={sub.name} className="size-12 shrink-0 bg-surface" sizes="48px" rounded="rounded-[6px]" />
                          <span className="min-w-0">
                            <span className="block text-[14px] font-medium leading-[18px] group-hover:text-black">{sub.name}</span>
                            <span className="mt-0.5 block text-xs text-sub">{countLabel(sub.product_count, ["товар", "товара", "товаров"])}</span>
                          </span>
                        </Link>
                        {sub.children.length > 0 ? (
                          <ul className="mt-2 flex flex-col gap-1.5 pl-1">
                            {sub.children.slice(0, 6).map((s3) => (
                              <li key={s3.slug}>
                                <Link href={`/catalog/${s3.slug}`} onClick={onClose} className="text-[13px] leading-[17px] text-sub hover:text-black">
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
        <button type="button" onClick={onClose} aria-label="Закрыть" className="absolute right-4 top-4 rounded p-1 text-sub transition-colors hover:bg-btn hover:text-black md:hidden">
          <X className="size-5" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
