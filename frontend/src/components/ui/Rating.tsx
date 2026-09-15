import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  const v = Math.max(0, Math.min(5, value));
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`Оценка ${v.toFixed(1)} из 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, v - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-line" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="text-brand" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function RatingLine({ rating, count, className }: { rating: number; count: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm text-sub", className)}>
      <Stars value={rating} />
      <span className="font-medium text-ink">{rating.toFixed(1).replace(".", ",")}</span>
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
