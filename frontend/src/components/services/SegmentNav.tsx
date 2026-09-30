"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export interface SegmentItem {
  id: string;
  label: string;
  /** доля ширины (в макете сегменты неравные: 252/216/272/222/290 из 1252) */
  weight: number;
}

/** Высота «липкой» зоны над секциями: шапка 114 + полоса навигации 72 + воздух (scroll-mt 210 в шаблоне). */
const STICKY_OFFSET = 214;

/**
 * Сегмент-навигация по якорям (Figma «Меню» 10877:3563): серый контейнер 1260×41 r10 #EEF0F2,
 * активный сегмент — белый r7 с тенью 0 2 4 2 /7%; текст 15/20 SemiBold (#000 активный, #333 остальные).
 * Активный пункт следует за прокруткой.
 */
export function SegmentNav({ items }: { items: SegmentItem[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      let current = items[0]?.id;
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top <= STICKY_OFFSET + 8) current = it.id;
      }
      // в самом низу страницы подсвечиваем последний пункт
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = items[items.length - 1]?.id;
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items]);

  return (
    <div className="bg-white pb-[16px] pt-[15px]">
      <nav aria-label="Разделы страницы" className="scrollbar-none overflow-x-auto rounded-[10px] bg-btn lg:overflow-visible">
        <ul className="flex h-[41px] min-w-max p-[4px] lg:min-w-0">
          {items.map((it) => {
            const on = it.id === active;
            return (
              <li key={it.id} className="flex" style={{ flex: `${it.weight} 1 0%` }}>
                <a
                  href={`#${it.id}`}
                  onClick={(e) => {
                    const el = document.getElementById(it.id);
                    if (!el) return;
                    e.preventDefault();
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                    history.replaceState(null, "", `#${it.id}`);
                    setActive(it.id);
                  }}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "flex h-[33px] w-full items-center justify-center whitespace-nowrap rounded-[7px] px-4 text-[15px] font-semibold leading-[20px] transition-colors",
                    on ? "bg-white text-black shadow-soft" : "text-g333 hover:text-black",
                  )}
                >
                  {it.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
