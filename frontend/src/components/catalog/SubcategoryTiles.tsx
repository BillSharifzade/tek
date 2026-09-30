import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/cn";

/** Картинки подкатегорий из макета (с их размерами/позициями в плитке) — запасные, если у категории нет своей. */
const FALLBACK = [
  { src: "/figma/subcat-floodlight.webp", l: 44.5, t: 15, w: 65, h: 59 },
  { src: "/figma/subcat-bulb.webp", l: 61, t: 12, w: 39, h: 67 },
  { src: "/figma/subcat-spot.webp", l: 36, t: 12, w: 86, h: 67 },
  { src: "/figma/subcat-bollard.webp", l: 74, t: 12, w: 15, h: 67 },
  { src: "/figma/subcat-strip.webp", l: 34, t: 12, w: 88, h: 57 },
];

export interface TileCategory {
  slug: string;
  name: string;
  image: string | null;
  product_count?: number;
}

/**
 * Плитка подкатегории 155×135 (макет 10745:5085): фон #F7F8F9, r=10, картинка по центру сверху (зона 88×67, сверху 12),
 * название Regular 14/17 #333 по центру, 2 строки.
 */
export function SubcategoryTile({ category, index = 0, className }: { category: TileCategory; index?: number; className?: string }) {
  // своя картинка — в зону 88×67 по центру (как самые крупные в макете); запасная — ровно как в макете
  const box = category.image ? { src: category.image, l: 33.5, t: 12, w: 88, h: 67 } : FALLBACK[index % FALLBACK.length];
  return (
    <Link
      href={`/catalog/${category.slug}`}
      className={cn("group relative block h-[135px] w-[155px] shrink-0 rounded-[10px] bg-surface-2 transition-colors hover:bg-[#EEF0F2]", className)}
      title={category.product_count !== undefined ? `${category.name} (${category.product_count})` : category.name}
    >
      <span className="absolute block" style={{ left: box.l, top: box.t, width: box.w, height: box.h }}>
        <Image src={box.src} alt="" fill unoptimized sizes="88px" className="object-contain mix-blend-multiply" />
      </span>
      <span className="absolute left-[11px] right-[12px] top-[87.5px] line-clamp-2 text-center text-[14px] leading-[17px] text-g333 transition-colors group-hover:text-black">
        {category.name}
      </span>
    </Link>
  );
}

/** Ряд плиток подкатегорий: шаг 170 (155 + 15). */
export function SubcategoryTiles({ items, className }: { items: TileCategory[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <ul className={cn("flex gap-[15px] max-sm:-mx-4 max-sm:overflow-x-auto max-sm:px-4 max-sm:pb-1 sm:flex-wrap", className)}>
      {items.map((c, i) => (
        <li key={c.slug}>
          <SubcategoryTile category={c} index={i} />
        </li>
      ))}
    </ul>
  );
}
