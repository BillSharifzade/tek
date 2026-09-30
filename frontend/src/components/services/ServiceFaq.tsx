"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { IconFaqCaret } from "./icons";

/** Аккордеон (Figma «Вопросы» 10888:3805): 584×49, r6; открытый — #FFCC33, закрытые — #EEF0F2; ответ 16/24 #333. */
export function ServiceFaq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const uid = useId();
  return (
    <ul className="mt-[30px] flex flex-col gap-[2px]">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <li key={it.q}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`${uid}-${i}`}
              onClick={() => setOpen(isOpen ? null : i)}
              className={cn(
                "relative block min-h-[49px] w-full rounded-[6px] pb-[13px] pl-[16px] pr-[48px] pt-[16px] text-left text-[14px] font-bold leading-[16px] text-black transition-colors",
                isOpen ? "bg-brand hover:bg-brand-hover" : "bg-btn hover:bg-btn-hover",
              )}
            >
              {it.q}
              <IconFaqCaret className="absolute right-[19px] top-[24px] text-[#5F6061]" />
            </button>
            <div id={`${uid}-${i}`} hidden={!isOpen} className="px-[16px] pb-[21px] pt-[16px] text-[16px] leading-[24px] text-g333 lg:pr-[14px]">
              {it.a}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
