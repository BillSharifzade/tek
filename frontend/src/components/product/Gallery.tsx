"use client";

import { useState } from "react";
import type { Badge as BadgeKind } from "@/lib/types";
import { cn } from "@/lib/cn";
import { ImageBox } from "@/components/ui/ImageBox";
import { BadgeList } from "@/components/ui/Badge";

export function Gallery({ images, name, badges, discountPct }: { images: string[]; name: string; badges: BadgeKind[]; discountPct?: number }) {
  const [idx, setIdx] = useState(0);
  const list = images.length > 0 ? images : [null];
  const current = list[Math.min(idx, list.length - 1)];

  return (
    <div className="flex flex-col gap-3 md:flex-row-reverse">
      <div className="relative min-w-0 flex-1">
        <ImageBox src={current} alt={name} className="aspect-square w-full border border-line" sizes="(max-width: 768px) 100vw, 520px" priority />
        <BadgeList badges={badges} discountPct={discountPct} className="absolute left-3 top-3" />
      </div>
      {list.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto scrollbar-none md:w-[72px] md:flex-col" aria-label="Изображения товара">
          {list.map((src, i) => (
            <li key={i} className="shrink-0">
              <button
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`Изображение ${i + 1}`}
                aria-current={i === idx}
                className={cn("block size-[72px] overflow-hidden rounded-[6px] border transition-colors", i === idx ? "border-brand" : "border-line hover:border-muted")}
              >
                <ImageBox src={src} alt="" label={name} className="size-full" sizes="72px" rounded="rounded-none" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
