import { useId } from "react";
import { cn } from "@/lib/cn";

/** Правильная пятиконечная звезда 14×13.4 (Figma «Vector», #FFCC33). */
const STAR = "M7 0L8.65 5.09H14L9.67 8.23L11.33 13.31L7 10.17L2.67 13.31L4.33 8.23L0 5.09H5.35Z";

export function Star({ size = 14, fill = 1, empty = "#D9D9D9", className }: { size?: number; fill?: number; empty?: string; className?: string }) {
  const h = (size * 13.4) / 14;
  // уникальный id на каждую звезду: общий id ломается, если первая копия на странице скрыта (display:none)
  const id = `st${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg width={size} height={h} viewBox="0 0 14 13.4" aria-hidden className={cn("shrink-0", className)}>
      {fill > 0 && fill < 1 ? (
        <defs>
          <linearGradient id={id}>
            <stop offset={fill} stopColor="#FFCC33" />
            <stop offset={fill} stopColor={empty} />
          </linearGradient>
        </defs>
      ) : null}
      <path d={STAR} fill={fill >= 1 ? "#FFCC33" : fill <= 0 ? empty : `url(#${id})`} />
    </svg>
  );
}

/** 5 звёзд; step — шаг между левыми краями (в карточке 16px при размере 14). */
export function Stars({ value, size = 14, step, className }: { value: number; size?: number; step?: number; className?: string }) {
  const v = Math.max(0, Math.min(5, value));
  const gap = (step ?? size + 2) - size;
  return (
    <span className={cn("inline-flex items-center", className)} style={{ gap }} aria-label={`Оценка ${v.toFixed(1)} из 5`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={Math.max(0, Math.min(1, v - (i - 1)))} />
      ))}
    </span>
  );
}

export function RatingLine({ rating, count, className }: { rating: number; count: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] leading-[15px] text-muted", className)}>
      <Stars value={rating} />
      <span>
        {count} {pluralReviews(count)}
      </span>
    </span>
  );
}

export function pluralReviews(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "отзывов";
  if (last > 1 && last < 5) return "отзыва";
  if (last === 1) return "отзыв";
  return "отзывов";
}
