"use client";

import { useMemo, useState } from "react";
import type { Accessory } from "@/lib/types";
import { cn } from "@/lib/cn";
import { AccessoryCard } from "./AccessoryCard";

const ROW = 5;

/** Кнопка «Еще» из макета: 99×32, обводка #B3BAC7 (hover #4F5A6D), r5, 15/20 #666. */
export function MoreButton({ onClick, loading, className }: { onClick: () => void; loading?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "flex h-[32px] w-[99px] items-center justify-center rounded-[5px] border border-outline text-[15px] leading-[20px] text-sub transition-colors hover:border-outline-hover hover:text-black disabled:opacity-60",
        className,
      )}
    >
      {loading ? "Загрузка…" : "Еще"}
    </button>
  );
}

/**
 * «Комплектующие» на странице товара (Figma 8612:316): чипсы-группы 39px (первая/активная — жёлтая,
 * остальные #EEF0F2, r5, 14/20 #333, через 11px), под ними ряд компактных карточек 216×421
 * (5 в ряд, шаг 229.5 — x = 0 / 230 / 459 / 689 …, на 18px ниже чипсов) и «Еще» через 32px.
 */
export function ProductAccessories({ items }: { items: Accessory[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, Accessory[]>();
    for (const a of items) map.set(a.group, [...(map.get(a.group) ?? []), a]);
    return [...map.entries()];
  }, [items]);
  const [tab, setTab] = useState(groups[0]?.[0] ?? "");
  const [expanded, setExpanded] = useState(false);

  if (groups.length === 0) return <p className="mt-[29px] text-[14px] leading-[20px] text-sub">Комплектующие для этого товара не указаны.</p>;
  const current = groups.find(([g]) => g === tab) ?? groups[0];
  const products = current[1].map((a) => a.product);
  const shown = expanded ? products : products.slice(0, ROW);

  return (
    <div>
      <div role="tablist" className="mt-[28px] flex flex-wrap gap-[11px]">
        {groups.map(([g]) => {
          const on = g === current[0];
          return (
            <button
              key={g}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => {
                setTab(g);
                setExpanded(false);
              }}
              className={cn(
                "flex h-[39px] items-center rounded-[5px] px-[16px] text-[14px] leading-[20px] text-g333 transition-colors",
                on ? "bg-brand hover:bg-brand-hover" : "bg-btn hover:bg-btn-hover",
              )}
            >
              {g}
            </button>
          );
        })}
      </div>
      <ul className="mt-[18px] grid grid-cols-2 gap-[10px] md:grid-cols-3 md:gap-[14px] lg:grid-cols-4 xl:grid-cols-[repeat(5,216px)] xl:gap-x-[13.5px]">
        {shown.map((p) => (
          <li key={p.id}>
            <AccessoryCard product={p} />
          </li>
        ))}
      </ul>
      {products.length > ROW && !expanded ? <MoreButton className="mx-auto mt-[32px]" onClick={() => setExpanded(true)} /> : null}
    </div>
  );
}
