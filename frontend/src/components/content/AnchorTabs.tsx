"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export interface AnchorTab {
  id: string;
  label: string;
}

/**
 * Сегментное меню-якоря из макета «Сервис центр ДГУ» (10877:3563): плашка #EEF0F2 r10 высотой 41,
 * активный пункт — белый r7 с тенью 0 2 4 2 /7%, текст Roboto 600 15/20 (#333 → активный #000).
 * Подсвечивает раздел, который сейчас в зоне видимости.
 */
export function AnchorTabs({ tabs, className }: { tabs: AnchorTab[]; className?: string }) {
  const [active, setActive] = useState(tabs[0]?.id);

  useEffect(() => {
    const fromHash = () => {
      const h = decodeURIComponent(window.location.hash.slice(1));
      if (tabs.some((t) => t.id === h)) setActive(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);

    // активный раздел — последний, чей верх уже прошёл под шапку (114px) + небольшой запас
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        let cur = tabs[0]?.id;
        for (const t of tabs) {
          const el = document.getElementById(t.id);
          if (el && el.getBoundingClientRect().top <= 160) cur = t.id;
        }
        const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
        setActive(atBottom ? tabs[tabs.length - 1]?.id : cur);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [tabs]);

  return (
    <nav aria-label="Разделы страницы" className={cn("-mx-4 overflow-x-auto px-4 scrollbar-none md:mx-0 md:px-0", className)}>
      <ul className="flex min-w-max gap-[4px] rounded-[10px] bg-btn p-[4px] md:min-w-0">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <li key={t.id} className="md:flex-1">
              <a
                href={`#${t.id}`}
                aria-current={on ? "true" : undefined}
                onClick={() => setActive(t.id)}
                className={cn(
                  "flex h-[33px] items-center justify-center whitespace-nowrap rounded-[7px] px-[18px] text-[15px] font-semibold leading-[20px] transition-colors",
                  on ? "bg-white text-black shadow-soft" : "text-g333 hover:bg-btn-hover hover:text-black",
                )}
              >
                {t.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
