"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export interface HeroSlide {
  image: string;
  alt: string;
  href?: string;
}

/** Смена слайда — каждые 5 с (после ручного переключения отсчёт начинается заново). */
const INTERVAL = 5000;

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width={8} height={14} viewBox="0 0 8 14" fill="none" aria-hidden className={dir === "left" ? "rotate-180" : undefined}>
      <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Слайдер первого экрана лендинга: стрелки по бокам, точки внизу (активная — #FFCC33), автопрокрутка 5 с.
 * Пока над слайдером курсор мыши или внутри фокус клавиатуры — пауза; при «уменьшении движения» автопрокрутки нет.
 * Заполняет родителя (рамка 888×439 r11 задаётся снаружи).
 */
export function HeroSlider({ slides, className }: { slides: HeroSlide[]; className?: string }) {
  const [rawIndex, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const count = slides.length;
  const index = count > 0 ? rawIndex % count : 0;
  const go = (i: number) => setIndex(((i % count) + count) % count);

  useEffect(() => {
    if (count < 2 || hovered || focused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % count), INTERVAL);
    return () => window.clearTimeout(t);
  }, [index, hovered, focused, count]);

  if (count === 0) return null;

  const arrow =
    "absolute top-1/2 z-[2] flex size-[40px] -translate-y-1/2 items-center justify-center rounded-full bg-btn text-black shadow-soft transition-colors hover:bg-btn-hover";

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      role="region"
      aria-roledescription="carousel"
      aria-label="ТЭК — Точикэлектрокомплект"
      // пауза при наведении — только для мыши (на тач-экране «наведение» залипает после касания)
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="flex h-full transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((s, i) => {
          const current = i === index;
          const img = (
            <Image
              src={s.image}
              alt={s.alt}
              fill
              priority={i === 0}
              sizes="(min-width: 1292px) 888px, (min-width: 1024px) 70vw, 100vw"
              className="object-cover"
            />
          );
          return (
            <div key={`${s.image}-${i}`} className="relative h-full w-full shrink-0" role="group" aria-roledescription="slide" aria-label={`${i + 1} из ${count}`} aria-hidden={!current}>
              {s.href ? (
                <Link href={s.href} tabIndex={current ? 0 : -1} className="absolute inset-0" aria-label={s.alt}>
                  {img}
                </Link>
              ) : (
                img
              )}
            </div>
          );
        })}
      </div>

      {count > 1 ? (
        <>
          <button type="button" onClick={() => go(index - 1)} aria-label="Предыдущий слайд" className={cn(arrow, "left-[16px]")}>
            <Chevron dir="left" />
          </button>
          <button type="button" onClick={() => go(index + 1)} aria-label="Следующий слайд" className={cn(arrow, "right-[16px]")}>
            <Chevron dir="right" />
          </button>
          <div className="absolute bottom-[12px] left-1/2 z-[2] flex -translate-x-1/2 items-center">
            {slides.map((s, i) => (
              <button key={`dot-${s.image}-${i}`} type="button" onClick={() => go(i)} aria-label={`Слайд ${i + 1}`} aria-current={i === index ? "true" : undefined} className="group/dot p-[5px]">
                <span className={cn("block size-[9px] rounded-full shadow-soft transition-colors", i === index ? "bg-brand" : "bg-white group-hover/dot:bg-brand-hover")} />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
