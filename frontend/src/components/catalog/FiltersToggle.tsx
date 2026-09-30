"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

/** На телефоне и планшете фильтры свёрнуты под кнопкой «Фильтры», чтобы товары были видны сразу. */
export function FiltersToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-[44px] w-full items-center justify-center gap-[8px] rounded-[6px] bg-btn text-[14px] font-medium text-black transition-colors hover:bg-btn-hover lg:hidden"
      >
        <SlidersHorizontal className="size-[16px]" aria-hidden />
        {open ? "Скрыть фильтры" : "Фильтры"}
      </button>
      <div className={cn(open ? "mt-[16px] lg:mt-0" : "max-lg:hidden")}>{children}</div>
    </>
  );
}
