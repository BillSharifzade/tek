import Image from "next/image";
import { cn } from "@/lib/cn";

/** Deterministic pastel from a string, for placeholder tiles. */
function hue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export interface ImageBoxProps {
  src: string | null | undefined;
  alt: string;
  /** used to derive placeholder initials + tint */
  label?: string;
  className?: string;
  imgClassName?: string;
  sizes?: string;
  priority?: boolean;
  /** "contain" for product photos on white, "cover" for banners */
  fit?: "contain" | "cover";
  rounded?: string;
}

/**
 * Image with a neutral SVG placeholder (initials on a soft tinted tile) when src is missing.
 * Uses next/image with fill; the parent sets the aspect ratio.
 */
export function ImageBox({ src, alt, label, className, imgClassName, sizes = "(max-width: 768px) 50vw, 25vw", priority, fit = "contain", rounded = "rounded-[8px]" }: ImageBoxProps) {
  const text = label ?? alt;
  if (!src) {
    const h = hue(text);
    return (
      <div className={cn("relative overflow-hidden bg-surface", rounded, className)} aria-label={alt} role="img">
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <linearGradient id={`g${h}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={`hsl(${h} 45% 96%)`} />
              <stop offset="100%" stopColor={`hsl(${h} 35% 90%)`} />
            </linearGradient>
          </defs>
          <rect width="200" height="200" fill={`url(#g${h})`} />
          <circle cx="100" cy="100" r="46" fill="#ffffff" opacity="0.9" />
          <text x="100" y="100" textAnchor="middle" dominantBaseline="central" fontFamily="Inter, system-ui, sans-serif" fontSize="30" fontWeight="600" fill="#3f3f3f">
            {initials(text)}
          </text>
        </svg>
      </div>
    );
  }
  return (
    <div className={cn("relative overflow-hidden bg-white", rounded, className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized
        className={cn(fit === "contain" ? "object-contain" : "object-cover", imgClassName)}
      />
    </div>
  );
}
