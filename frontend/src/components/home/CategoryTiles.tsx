import Image from "next/image";
import Link from "next/link";
import { countLabel } from "@/lib/format";
import { cn } from "@/lib/cn";

export interface CategoryTileData {
  slug: string;
  name: string;
  image: string | null;
  product_count: number;
}

const REEL = "/figma/cable-reel.webp";

/** В макете у всех плиток — катушка кабеля; фото категории используем, только если это растровое изображение. */
function tileImage(src: string | null): string {
  return src && /\.(webp|png|jpe?g|avif)(\?|$)/i.test(src) ? src : REEL;
}

function Tile({ c, wide, className }: { c: CategoryTileData; wide?: boolean; className?: string }) {
  return (
    <li className={className}>
      <Link
        href={`/catalog/${c.slug}`}
        className="group relative block h-[122px] overflow-hidden rounded-[8px] bg-surface pl-4 pr-2 pt-[14px] transition-shadow hover:shadow-card"
      >
        <span
          className={cn(
            "relative z-[1] line-clamp-2 hyphens-auto break-words font-bold leading-[20px] text-black",
            wide ? "text-[13px] sm:max-w-[181px] sm:text-[14px] xl:text-[16px]" : "text-[13px] sm:max-w-[153px] sm:text-[14px] xl:text-[15px]",
          )}
        >
          {c.name}
        </span>
        <span className="relative z-[1] mt-px block text-[13px] leading-[21px] text-sub">{countLabel(c.product_count, ["товар", "товара", "товаров"])}</span>
        <Image src={tileImage(c.image)} alt="" width={71} height={67} className="absolute bottom-0 right-0 h-[67px] w-[71px] object-contain object-right-bottom" sizes="71px" />
      </Link>
    </li>
  );
}

/** Плитки категорий (Figma 10999:2865): 6 × 199×122 и 5 × 241×122, зазор 13. */
export function CategoryTiles({ items }: { items: CategoryTileData[] }) {
  if (items.length === 0) return null;
  const first = items.slice(0, 6);
  const second = items.slice(6, 11);
  return (
    <section className="container-page mt-10 lg:mt-[60px]" aria-label="Популярные категории">
      <h2 className="sr-only">Популярные категории</h2>
      <ul className="grid grid-cols-2 gap-[13px] sm:grid-cols-3 lg:ml-px lg:grid-cols-6">
        {first.map((c) => (
          <Tile key={c.slug} c={c} />
        ))}
      </ul>
      {second.length > 0 ? (
        <ul className="mt-[13px] grid grid-cols-2 gap-[13px] sm:grid-cols-3 lg:ml-px lg:mr-[2px] lg:grid-cols-5">
          {second.map((c, i) => (
            // 11-я плитка на телефоне (2 колонки) осталась бы одна в ряду
            <Tile key={c.slug} c={c} wide className={i === 4 ? "max-sm:hidden" : undefined} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
