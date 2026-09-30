"use client";

import { useRef, useState } from "react";
import { CITIES, useCity } from "@/store/city";
import { useClickOutside, useHydrated } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { IconPin } from "@/components/icons/figma";

export function CitySelect({ className }: { className?: string }) {
  const city = useCity((s) => s.city);
  const setCity = useCity((s) => s.setCity);
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-start gap-[3px] text-[13px] leading-[12px] text-sub link-hover"
      >
        <IconPin className="shrink-0" />
        <span className="mt-px whitespace-nowrap">{hydrated ? city : "Душанбе"}</span>
      </button>
      {open ? (
        <ul role="listbox" className="absolute right-0 top-full z-[90] mt-[10px] min-w-[160px] overflow-hidden rounded-[6px] bg-white py-[6px] shadow-pop animate-fade-in">
          {CITIES.map((c) => (
            <li key={c}>
              <button
                type="button"
                role="option"
                aria-selected={city === c}
                onClick={() => {
                  setCity(c);
                  setOpen(false);
                }}
                className={cn("block w-full px-4 py-[8px] text-left text-[14px] leading-[18px] text-g333 hover:bg-surface hover:text-black", city === c && "font-medium text-black")}
              >
                {c}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
