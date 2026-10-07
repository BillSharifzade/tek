"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Home } from "@/lib/types";
import { cn } from "@/lib/cn";
import { brandLogo, hasRealLogo } from "@/components/content/brands";

const SLOTS = 6;
/** каждый логотип держится 3 с, затем гаснет и на его месте появляется другой */
const HOLD = 3000;
const FADE = 400;

/**
 * Полоса вендоров (Figma 10999:2816): карточка 1260×92, r=11, тень 0 1 7 3 /7%,
 * жёлтый ярлык «20+ вендоров» 105×25 по центру верхней кромки, 6 логотипов с шагом 194 (логотип ≈97×29).
 * Логотипы — настоящие (public/corporate/brands/*.webp, как на страницах проектов/брендов);
 * бренды с настоящим логотипом идут первыми, у остальных — словесный знак или `logo` из API.
 * Если вендоров больше шести, логотипы сменяются вразброс: у каждого места свой таймер со случайным сдвигом.
 */
export function BrandStrip({ brands }: { brands: Home["brands"] }) {
  const pool = useMemo(() => [...brands].sort((a, b) => Number(hasRealLogo(b.slug)) - Number(hasRealLogo(a.slug))), [brands]);
  // что стоит на каждом месте (индексы в pool) и какие места сейчас гаснут
  const [shown, setShown] = useState<number[]>(() => pool.slice(0, SLOTS).map((_, i) => i));
  const [fading, setFading] = useState<boolean[]>(() => Array(SLOTS).fill(false));

  useEffect(() => {
    if (pool.length <= SLOTS || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // своя копия раскладки и очередь логотипов, которых сейчас нет на полосе (состояние меняется только в таймерах)
    let current = pool.slice(0, SLOTS).map((_, i) => i);
    const queue = pool.map((_, i) => i).slice(SLOTS);
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };
    const swap = (slot: number) => {
      setFading((f) => f.map((v, i) => (i === slot ? true : v)));
      later(() => {
        const next = queue.shift();
        if (next !== undefined) {
          queue.push(current[slot]);
          current = current.map((v, i) => (i === slot ? next : v));
          setShown(current);
        }
        setFading((f) => f.map((v, i) => (i === slot ? false : v)));
      }, FADE);
    };
    for (let slot = 0; slot < SLOTS; slot++) {
      // первые смены разнесены по 3-секундному окну в случайном порядке, дальше — раз в 3 с у каждого места
      const offset = HOLD + Math.random() * HOLD;
      later(() => {
        swap(slot);
        timers.add(window.setInterval(() => swap(slot), HOLD + FADE));
      }, offset);
    }
    return () => {
      for (const t of timers) {
        window.clearTimeout(t);
        window.clearInterval(t);
      }
    };
  }, [pool]);

  const list = shown.map((i) => pool[i]).filter(Boolean);
  if (list.length === 0) return null;
  return (
    <section className="container-page mt-10 lg:mt-[21px]" aria-label="Бренды">
      <div className="relative pt-[13px]">
        <Link
          href="/brands"
          className="absolute left-[calc(50%+0.5px)] top-0 z-10 h-[25px] w-[105px] -translate-x-1/2 rounded-[7px] bg-brand pt-[6px] text-center text-[14px] font-semibold leading-[13px] text-g333 transition-colors hover:bg-brand-hover hover:text-black"
        >
          20+ вендоров
        </Link>
        <ul className="grid grid-cols-3 gap-y-2 rounded-[11px] bg-white px-4 py-4 shadow-[0_1px_7px_3px_rgba(0,0,0,0.07)] sm:grid-cols-6 lg:h-[92px] lg:py-0 lg:pl-[48.5px] lg:pr-[47.5px]">
          {list.map((b, slot) => {
            const logo = brandLogo(b);
            return (
              <li key={slot} className="flex items-center justify-center">
                <Link
                  href={`/brands/${b.slug}`}
                  className={cn("flex h-[61px] w-full max-w-[122px] items-center justify-center transition-opacity duration-[400ms] hover:opacity-80", fading[slot] && "opacity-0 hover:opacity-0")}
                  title={b.name}
                >
                  {logo ? (
                    <span className="relative h-[29px] w-[96px] lg:w-[110px]">
                      <Image src={logo} alt={b.name} fill sizes="110px" className="object-contain" />
                    </span>
                  ) : (
                    <span className="line-clamp-2 text-center text-[15px] font-bold leading-[18px] text-g333">{b.name}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
