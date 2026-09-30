"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Product } from "@/lib/types";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { FavoriteButton } from "./FavoriteButton";
import { priceLabel } from "./ProductCard";
import { useBuy } from "./BuyContext";

export interface TabAnchor {
  id: string;
  label: string;
  count?: number;
}

/* ---------- активная секция и прокрутка (общие для обеих панелей) ---------- */

type Listener = () => void;
const store = { active: "", listeners: new Set<Listener>() };
function setActive(id: string) {
  if (store.active === id) return;
  store.active = id;
  store.listeners.forEach((l) => l());
}
function useActive(fallback: string) {
  const v = useSyncExternalStore(
    (l) => {
      store.listeners.add(l);
      return () => store.listeners.delete(l);
    },
    () => store.active,
    () => "",
  );
  return v || fallback;
}

/** Высота шапки сайта (113 + линия) — плавающая панель товара прилипает под неё. */
function headerHeight(): number {
  const h = document.getElementById("site-header");
  return h ? h.getBoundingClientRect().height : 0;
}
const STICKY_H = 148; // полоса товара 78 + табы 70 (Figma 10444:276: 114…262)
const CONTENT_GAP = 25; // табы → контент, как в макете (1097 → 1122)

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const offset = headerHeight() + (window.innerWidth >= 1024 ? STICKY_H : 60) + CONTENT_GAP;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
  setActive(id);
}

/* ---------- сегмент-табы (Figma «Меню»: 1260×43, #EEF0F2 r10, активная — белая 308×35 r7 с тенью) ---------- */

export function SegmentTabs({ tabs, active, onSelect, className }: { tabs: TabAnchor[]; active: string; onSelect: (id: string) => void; className?: string }) {
  return (
    <div role="tablist" className={cn("flex h-[43px] gap-[4px] overflow-x-auto rounded-[10px] bg-btn p-[4px] scrollbar-none xl:justify-between xl:gap-0", className)}>
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onSelect(t.id)}
            className={cn(
              "flex h-[35px] min-w-max flex-1 items-center justify-center whitespace-nowrap rounded-[7px] px-4 pt-[2px] text-[16px] font-semibold leading-[20px] transition-colors xl:w-[308px] xl:flex-none",
              on ? "bg-white text-black shadow-soft" : "text-g333 hover:text-black",
            )}
          >
            {t.label}
            {t.count !== undefined ? ` (${t.count})` : ""}
          </button>
        );
      })}
    </div>
  );
}

/** Следит за секциями: активна последняя, чей верх выше линии под плавающей панелью. */
function useScrollSpy(ids: string[]) {
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = headerHeight() + STICKY_H + CONTENT_GAP + 40;
      let cur = ids[0] ?? "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) cur = id;
      }
      // до конца страницы — последняя секция
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) cur = ids[ids.length - 1] ?? cur;
      setActive(cur);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ids]);
}

/**
 * Табы в потоке страницы + плавающая шапка товара (Figma 10444:276), которая появляется,
 * когда табы уходят под шапку сайта (прокрутка ниже характеристик).
 */
export function ProductTabsBar({ tabs, product, className }: { tabs: TabAnchor[]; product: Product; className?: string }) {
  const key = tabs.map((t) => t.id).join(",");
  const ids = useMemo(() => key.split(","), [key]);
  useScrollSpy(ids);
  const active = useActive(tabs[0]?.id ?? "");

  const anchorRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const [top, setTop] = useState(113);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const measure = () => {
      const h = headerHeight();
      setTop(h);
      setStuck(el.getBoundingClientRect().bottom <= h);
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  const select = useCallback((id: string) => scrollToSection(id), []);

  return (
    <>
      <div ref={anchorRef} className={className}>
        <SegmentTabs tabs={tabs} active={active} onSelect={select} />
      </div>
      <StickyProductBar product={product} tabs={tabs} active={active} onSelect={select} visible={stuck} top={top} />
    </>
  );
}

function StickyProductBar({
  product,
  tabs,
  active,
  onSelect,
  visible,
  top,
}: {
  product: Product;
  tabs: TabAnchor[];
  active: string;
  onSelect: (id: string) => void;
  visible: boolean;
  top: number;
}) {
  const { addToCart, busy, inCartQty } = useBuy();
  const oos = !product.in_stock;
  const sale = product.price.sale && !oos;
  const img = product.images[0] ?? product.image;

  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      style={{ top }}
      className={cn(
        "fixed inset-x-0 z-[79] border-b border-line-2 bg-white shadow-[0_1px_4px_0_rgba(0,0,0,0.09)] transition-[transform,opacity] duration-200",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0",
      )}
    >
      <div className="hidden border-b border-line-2 lg:block">
        <div className="container-page flex h-[77px] items-start">
          {img ? (
            <span className="relative mt-[15px] size-[45px] shrink-0 overflow-hidden rounded-[5px] xl:ml-px">
              <Image src={img} alt="" fill sizes="45px" unoptimized className="object-cover" />
            </span>
          ) : null}
          <p className="ml-[17px] mt-[28.7px] line-clamp-2 min-w-0 flex-1 pr-6 text-[14px] font-semibold leading-[15px] text-black">{product.name}</p>
          <div className="ml-auto w-[150px] shrink-0">
            <p className="mt-[18.7px] text-[14px] leading-[15px] text-sub">{priceLabel(product)}</p>
            <p className={cn("mt-[2.7px] whitespace-nowrap text-[20px] font-semibold leading-[20px] tnum", sale ? "text-sale" : "text-black")}>
              {oos ? "–" : money(product.price.price)}
            </p>
          </div>
          <FavoriteButton product={product} box={45} boxH={44} glyph={20} className="mt-[16px]" />
          {oos ? (
            <span className="ml-[11px] mt-[16px] flex h-[44px] w-[188px] items-center justify-center rounded-[7px] bg-surface text-[14px] font-medium leading-[24px] text-black">
              Нет в наличии
            </span>
          ) : inCartQty > 0 ? (
            <a
              href="/cart"
              className="ml-[11px] mt-[16px] flex h-[44px] w-[188px] items-center justify-center rounded-[7px] text-[14px] font-medium leading-[24px] text-brand shadow-[inset_0_0_0_2px_#FFCC33] transition-colors hover:bg-brand hover:text-black"
            >
              В корзине
            </a>
          ) : (
            <button
              type="button"
              onClick={addToCart}
              disabled={busy}
              className="ml-[11px] mt-[16px] flex h-[44px] w-[188px] items-center justify-center rounded-[7px] bg-brand text-[14px] font-medium leading-[24px] text-black transition-colors hover:bg-brand-hover disabled:opacity-70"
            >
              В корзину
            </button>
          )}
        </div>
      </div>
      <div className="container-page py-[8px] lg:py-[13px]">
        <SegmentTabs tabs={tabs} active={active} onSelect={onSelect} />
      </div>
    </div>
  );
}
