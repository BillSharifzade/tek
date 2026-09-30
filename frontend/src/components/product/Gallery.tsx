"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Badge as BadgeKind } from "@/lib/types";
import { cn } from "@/lib/cn";
import { BADGE_LABELS } from "@/components/ui/Badge";
import { IconChevronDown } from "./icons";

/** Плашки на большом фото (Figma «Инфо поле 2/3/4»): 22px, r3, Roboto Medium 12/15, в ряд через 7px. */
const BIG_BADGE: Record<BadgeKind, string> = {
  sale: "w-[92px] bg-sale-bg text-sale-text",
  hit: "w-[87px] bg-hit-bg text-hit",
  new: "w-[69px] bg-new-bg text-new",
};
const ORDER: BadgeKind[] = ["sale", "hit", "new"];

const THUMB_STEP = 66; // 56 + 10
const THUMBS_VIEW = 431; // видимая высота колонки миниатюр (6.5 шт.)

/**
 * Галерея товара — Figma «Фото»: колонка миниатюр 56×56 (шаг 66, активная — жёлтая рамка 2px),
 * стрелка вниз под колонкой, большое фото 449×449 справа (x+79), плашки в ряд поверх фото.
 */
export function Gallery({ images, name, badges }: { images: string[]; name: string; badges: BadgeKind[] }) {
  const list = images.length > 0 ? images : [];
  const [idx, setIdx] = useState(0);
  const railRef = useRef<HTMLUListElement>(null);
  const [canDown, setCanDown] = useState(false);
  const current = list[Math.min(idx, Math.max(list.length - 1, 0))] ?? null;
  const sorted = ORDER.filter((b) => badges.includes(b));

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const check = () => setCanDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
    check();
    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  }, [list.length]);

  const select = (i: number) => {
    setIdx(i);
    const el = railRef.current;
    if (!el) return;
    const top = i * THUMB_STEP;
    if (top < el.scrollTop || top + 56 > el.scrollTop + el.clientHeight) el.scrollTo({ top: Math.max(0, top - THUMB_STEP * 2), behavior: "smooth" });
  };

  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row md:items-start md:gap-[23px] xl:pl-[2px]">
      {list.length > 0 ? (
        <div className="shrink-0 md:w-[56px]">
          <ul
            ref={railRef}
            className="flex gap-[10px] overflow-auto scrollbar-none md:flex-col"
            style={{ maxHeight: THUMBS_VIEW }}
            aria-label="Изображения товара"
          >
            {list.map((src, i) => (
              <li key={`${src}-${i}`} className="shrink-0">
                <button
                  type="button"
                  onClick={() => select(i)}
                  aria-label={`Изображение ${i + 1}`}
                  aria-current={i === idx}
                  className={cn(
                    "relative block w-[56px] overflow-hidden rounded-[5px] bg-white transition-colors",
                    i === idx ? "h-[55px] border-2 border-brand" : "h-[56px] border border-[#ECEEF2] hover:border-outline",
                  )}
                >
                  <Image src={src} alt="" fill sizes="56px" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
          {canDown ? (
            <button
              type="button"
              onClick={() => railRef.current?.scrollBy({ top: THUMB_STEP * 3, behavior: "smooth" })}
              aria-label="Следующие изображения"
              className="mx-auto mt-[11px] hidden h-[14px] w-[28px] items-start justify-center text-[#5F6061] hover:text-black md:flex"
            >
              <IconChevronDown />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="relative aspect-square w-full md:w-[449px] md:shrink-0">
        {current ? (
          <Image src={current} alt={name} fill priority sizes="(max-width: 768px) 100vw, 449px" className="object-cover" />
        ) : (
          <div className="absolute inset-0 rounded-[10px] bg-surface" aria-hidden />
        )}
        {sorted.length > 0 ? (
          <div className="pointer-events-none absolute left-[10px] top-[9px] flex gap-[7px]">
            {sorted.map((b) => (
              <span key={b} className={cn("inline-flex h-[22px] items-start justify-center rounded-[3px] pt-[3px] text-[12px] font-medium leading-[15px]", BIG_BADGE[b])}>
                {BADGE_LABELS[b]}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
