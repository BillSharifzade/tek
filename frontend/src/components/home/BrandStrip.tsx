import Link from "next/link";
import type { Home } from "@/lib/types";

/**
 * Полоса вендоров (Figma 10999:2816): карточка 1260×92, r=11, тень 0 1 7 3 /7%,
 * жёлтый ярлык «20+ вендоров» 105×25 по центру верхней кромки, 6 логотипов с шагом 194.
 */
export function BrandStrip({ brands }: { brands: Home["brands"] }) {
  const list = brands.slice(0, 6);
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
          {list.map((b) => (
            <li key={b.slug} className="flex items-center justify-center">
              <Link href={`/brands/${b.slug}`} className="flex h-[61px] w-full max-w-[122px] items-center justify-center opacity-100 transition-opacity hover:opacity-80" title={b.name}>
                {b.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- SVG-логотипы с бэкенда, оптимизация не нужна
                  <img src={b.logo} alt={b.name} width={122} height={61} className="h-full w-full object-contain" loading="lazy" />
                ) : (
                  <span className="line-clamp-2 text-center text-[15px] font-bold leading-[18px] text-g333">{b.name}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
