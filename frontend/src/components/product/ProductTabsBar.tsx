"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export interface TabAnchor {
  id: string;
  label: string;
  count?: number;
}

/** Sticky in-page tab bar; highlights the section currently in view and scrolls on click. */
export function ProductTabsBar({ tabs }: { tabs: TabAnchor[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    const els = tabs.map((t) => document.getElementById(t.id)).filter((x): x is HTMLElement => Boolean(x));
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-140px 0px -60% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [tabs]);

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 130;
    window.scrollTo({ top, behavior: "smooth" });
    setActive(id);
  };

  return (
    <div className="sticky top-[64px] z-[70] -mx-5 border-b border-line bg-white/95 px-5 backdrop-blur md:mx-0 md:px-0">
      <div role="tablist" className="flex items-end gap-8 overflow-x-auto scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active === t.id}
            onClick={() => go(t.id)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 py-3.5 text-md font-medium transition-colors",
              active === t.id ? "border-brand text-ink" : "border-transparent text-sub hover:text-ink",
            )}
          >
            {t.label}
            {t.count !== undefined ? <span className="ml-1 text-sub">({t.count})</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
