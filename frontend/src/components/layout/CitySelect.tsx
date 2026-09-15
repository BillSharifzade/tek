"use client";

import { ChevronDown, MapPin } from "lucide-react";
import { useRef, useState } from "react";
import { CITIES, useCity } from "@/store/city";
import { useClickOutside, useHydrated } from "@/lib/hooks";
import { cn } from "@/lib/cn";

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
        className="inline-flex items-center gap-1 font-medium transition-colors hover:text-sub"
      >
        <MapPin className="size-3.5 text-brand" />
        {hydrated ? city : "Душанбе"}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <ul role="listbox" className="absolute right-0 top-full z-50 mt-2 min-w-[160px] overflow-hidden rounded-[8px] border border-line bg-white py-1 shadow-pop animate-fade-in">
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
                className={cn("block w-full px-4 py-2 text-left text-base hover:bg-surface", city === c && "font-semibold")}
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
