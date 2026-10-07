"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product, VariantItem } from "@/lib/types";
import { axisOptions, sideChanges, type VariantOption } from "@/lib/variants";
import { swatch } from "@/lib/colors";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useOfferNav } from "./OfferScope";

/** Кнопка значения (Figma): 38px, текст 14/15 #333, поля 15.5px, r6, обводка #D9DDE4. */
const CHIP: Record<VariantOption["state"], string> = {
  active: "text-g333 shadow-[inset_0_0_0_2px_#FFCC33]",
  available: "text-g333 shadow-[inset_0_0_0_1px_#D9DDE4] hover:shadow-[inset_0_0_0_1px_#4F5A6D]",
  out: "bg-btn text-[#78797A] hover:bg-btn-hover",
  // сочетания с остальными параметрами нет — пунктир, клик переключит и их
  other: "border border-dashed border-[#C5CAD3] px-[14.5px] text-[#78797A] hover:border-outline-hover hover:text-g333",
};

/** Свотч цвета 40×40 (внутри квадрат 28×28 без скругления и обводки): выбранный — жёлтая рамка, остальные — как кнопки. */
const SWATCH: Record<VariantOption["state"], string> = {
  active: "border border-brand",
  available: "border border-line-3 hover:border-outline-hover",
  out: "bg-btn hover:bg-btn-hover",
  other: "border border-dashed border-[#C5CAD3] hover:border-outline-hover [&>span:first-child]:opacity-45 hover:[&>span:first-child]:opacity-100",
};

function hint(o: VariantOption, sides: string): string {
  const t = o.target;
  switch (o.state) {
    case "active":
      return `Выбрано · код ${t.code}`;
    case "available":
      return `Код ${t.code} · ${money(t.price)}/${t.unit}`;
    case "out":
      return `Нет в наличии · код ${t.code}`;
    case "other":
      return `Нет в сочетании с выбранными параметрами. Будет выбрано: ${sides}`;
  }
}

/**
 * «Динамическое торговое предложение» (Figma) для товара с несколькими исполнениями, как у Петровича:
 * по каждой оси — подпись «Ширина, мм: 100» (14/15, #666 + #000) и кнопки значений под ней через 13px; оси — через 26px.
 * Клик открывает соседнее исполнение (свой URL, код, фото, цена, остатки) без перезагрузки и прокрутки;
 * если нужного сочетания нет — ближайшее по остальным осям. Наведение/фокус заранее подгружают исполнение и его фото.
 */
export function OfferSelector({ product, className }: { product: Product; className?: string }) {
  const nav = useOfferNav();
  const [warm, setWarm] = useState<ReadonlySet<string>>(() => new Set());
  const v = product.variants;
  const own = v?.items.find((i) => i.slug === product.slug);
  if (!v || !own || v.items.length < 2) return null;
  const current = (nav?.pending ? v.items.find((i) => i.slug === nav.pending) : null) ?? own;

  const intent = (it: VariantItem) => {
    if (it.slug === product.slug || warm.has(it.slug)) return;
    setWarm((s) => new Set(s).add(it.slug));
    if (it.image) new window.Image().src = it.image;
  };
  const click = (e: React.MouseEvent, it: VariantItem) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || !nav) return; // новая вкладка — обычной ссылкой
    e.preventDefault();
    if (it.slug !== current.slug) nav.open(it.slug);
  };

  return (
    <div className={cn("flex flex-col gap-[26px]", className)}>
      {v.axes.map((axis, i) => {
        const isColor = /цвет/i.test(axis.name);
        return (
          <div key={axis.name}>
            <p className="text-[14px] leading-[15px] text-black">
              <span className="text-sub">{axis.name}: </span>
              {current.values[axis.name]}
            </p>
            <ul className="mt-[13px] flex flex-wrap gap-[8px] xl:pl-px" aria-label={axis.name}>
              {axisOptions(v, current, i).map((o) => {
                const colors = isColor ? swatch(o.value) : [];
                const active = o.state === "active";
                return (
                  <li key={o.value}>
                    <Link
                      href={`/product/${o.target.slug}`}
                      prefetch={warm.has(o.target.slug)}
                      scroll={false}
                      aria-current={active ? "page" : undefined}
                      title={hint(o, o.state === "other" ? sideChanges(v, current, o.target, i) : "")}
                      onMouseEnter={() => intent(o.target)}
                      onFocus={() => intent(o.target)}
                      onTouchStart={() => intent(o.target)}
                      onClick={(e) => click(e, o.target)}
                      className={cn(
                        "flex items-center justify-center rounded-[6px] transition-[color,background-color,border-color,box-shadow,opacity]",
                        colors.length > 0 ? cn("size-[40px]", SWATCH[o.state]) : cn("h-[38px] whitespace-nowrap px-[15.5px] text-[14px] leading-[15px]", CHIP[o.state]),
                        active && "cursor-default",
                      )}
                    >
                      {colors.length > 0 ? (
                        <>
                          <span className="flex size-[28px] overflow-hidden transition-opacity">
                            {colors.map((c) => (
                              <span key={c} className="h-full flex-1" style={{ background: c }} />
                            ))}
                          </span>
                          <span className="sr-only">{o.value}</span>
                        </>
                      ) : (
                        o.value
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
