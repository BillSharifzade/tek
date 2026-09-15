"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import type { Banner } from "@/lib/types";
import { cn } from "@/lib/cn";
import { ImageBox } from "@/components/ui/ImageBox";

export function Hero({ banners }: { banners: Banner[] }) {
  const [idx, setIdx] = useState(0);
  const count = banners.length;

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % count), 7000);
    return () => clearInterval(t);
  }, [count]);

  if (count === 0) return null;
  const b = banners[idx];

  return (
    <section className="container-page mt-5" aria-roledescription="карусель" aria-label="Акции и сервисы">
      <div className="relative overflow-hidden rounded-[8px] bg-ink text-white">
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,#5a5a5a_0%,#3f3f3f_45%,#2c2c2c_100%)]" aria-hidden />
        <div className="absolute -right-24 -top-24 size-[420px] rounded-full bg-brand/20 blur-3xl" aria-hidden />
        <div className="relative grid min-h-[320px] grid-cols-1 items-center gap-8 px-8 py-10 md:grid-cols-[1.2fr_1fr] md:px-14 md:py-12">
          <div className="max-w-[560px] animate-fade-in" key={b.id}>
            <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-ink">
              <Zap className="size-3.5" fill="currentColor" strokeWidth={0} />
              Конфигуратор
            </span>
            <h1 className="text-3xl font-semibold text-white md:text-4xl">{b.title}</h1>
            <p className="mt-4 text-md text-white/75">{b.text}</p>
            <Link
              href={b.cta_url}
              className="mt-7 inline-flex h-11 items-center gap-2 rounded-[6px] bg-brand px-6 text-base font-semibold text-ink transition-colors hover:bg-brand-hover"
            >
              {b.cta_text}
              <ChevronRight className="size-4" />
            </Link>
          </div>
          <div className="relative hidden h-[240px] md:block">
            {b.image ? (
              <ImageBox src={b.image} alt="" label={b.title} className="h-full w-full bg-transparent" fit="contain" sizes="50vw" priority rounded="rounded-none" />
            ) : (
              <HeroArt />
            )}
          </div>
        </div>
        {count > 1 ? (
          <>
            <div className="absolute bottom-5 left-8 flex items-center gap-2 md:left-14">
              {banners.map((x, i) => (
                <button
                  key={x.id}
                  type="button"
                  aria-label={`Слайд ${i + 1}`}
                  aria-current={i === idx}
                  onClick={() => setIdx(i)}
                  className={cn("h-1.5 rounded-full transition-all", i === idx ? "w-8 bg-brand" : "w-3 bg-white/40 hover:bg-white/70")}
                />
              ))}
            </div>
            <div className="absolute bottom-4 right-6 flex items-center gap-2">
              <button type="button" aria-label="Предыдущий слайд" onClick={() => setIdx((i) => (i - 1 + count) % count)} className="flex size-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-brand hover:text-ink">
                <ChevronLeft className="size-4" />
              </button>
              <button type="button" aria-label="Следующий слайд" onClick={() => setIdx((i) => (i + 1) % count)} className="flex size-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-brand hover:text-ink">
                <ChevronRight className="size-4" />
              </button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

/** Abstract cable-tray illustration used when a banner has no image. */
function HeroArt() {
  return (
    <svg viewBox="0 0 480 240" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="hero-tray" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(${40 + i * 70} ${30 + i * 28}) skewY(-14)`}>
          <rect width="260" height="42" rx="6" fill="url(#hero-tray)" stroke="#ffffff" strokeOpacity="0.18" />
          {Array.from({ length: 9 }).map((_, j) => (
            <rect key={j} x={14 + j * 27} y="14" width="12" height="14" rx="2" fill="#f4c241" fillOpacity={0.55 - i * 0.1} />
          ))}
        </g>
      ))}
      <circle cx="420" cy="60" r="34" fill="#f4c241" fillOpacity="0.9" />
      <path d="M414 40 l-10 24 h12 l-6 20 l20 -28 h-12 l8 -16z" fill="#3f3f3f" />
    </svg>
  );
}
