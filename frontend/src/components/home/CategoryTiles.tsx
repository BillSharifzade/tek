import Image from "next/image";
import Link from "next/link";
import { countLabel } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Плитка категории из макета: фото (public/figma/categories) в своём прямоугольнике, отсчитанном от правого
 * верхнего угла плитки (в узких колонках фото остаётся у правого края). `crop` — Figma STRETCH с imageTransform:
 * видна часть картинки, картинка целиком w×h сдвинута на left/top внутри прямоугольника.
 */
interface HomeTile {
  slug: string;
  /** подпись как в макете; «\n» — перенос из макета */
  name: string;
  /** [right, top, width, height] прямоугольника фото, px */
  box: [number, number, number, number];
  crop?: { w: number; h: number; left: number; top: number };
  /** ширина подписи, если отличается от ряда (153 / 181) */
  textW?: number;
}

/** Figma «Популярные категории» 10999:2866 (редакция 06.10): 6 плиток 199×122 и 5 плиток 241×122, зазор 13. */
const ROW1: HomeTile[] = [
  { slug: "kabeli-i-provoda", name: "Кабели и провода", box: [5, 42, 79, 77], crop: { w: 75.15, h: 71.25, left: 1.9, top: 2.75 } },
  { slug: "kabelenesushchie-sistemy", name: "Кабеленесущие системы", box: [0, 0, 91, 113], crop: { w: 113.85, h: 113, left: 0, top: 0 } },
  { slug: "nizkovoltnoe-oborudovanie", name: "Низковольтное оборудование", box: [-3, 36, 87, 87] },
  { slug: "shchitovoe-oborudovanie", name: "Щитовое оборудование", box: [-11, 24, 103, 103] },
  { slug: "svetotekhnika", name: "Светотехника", box: [-9, 35, 120, 90] },
  { slug: "elektroustanovochnye-izdeliya", name: "Электроустановочные изделия", box: [10, 47, 73, 73], crop: { w: 217.88, h: 223.19, left: -30.21, top: -42.79 }, textW: 167 },
];
const ROW2: HomeTile[] = [
  { slug: "instrumenty", name: "Инструменты", box: [29, 26, 65, 88] },
  { slug: "solnechnaya-energetika", name: "Солнечная\nэнергетика", box: [16, 23, 94, 93] },
  { slug: "generatory", name: "Генераторы", box: [0, 26, 135, 96], crop: { w: 135.79, h: 111, left: -0.39, top: 0 } },
  { slug: "elektromontazhnaya-produktsiya", name: "Электромонтажная продукция", box: [0, 34, 114, 94] },
  { slug: "molniezashchita-i-zazemlenie", name: "Молниезащита и заземление", box: [17, 20, 86, 94] },
];

function TilePhoto({ t }: { t: HomeTile }) {
  const [right, top, width, height] = t.box;
  const src = `/figma/categories/${t.slug}.png`;
  return (
    <span aria-hidden className="pointer-events-none absolute overflow-hidden" style={{ right, top, width, height }}>
      {t.crop ? (
        <Image
          src={src}
          alt=""
          width={Math.round(t.crop.w)}
          height={Math.round(t.crop.h)}
          className="absolute"
          style={{ left: t.crop.left, top: t.crop.top, width: t.crop.w, height: t.crop.h, maxWidth: "none" }}
        />
      ) : (
        <Image src={src} alt="" width={width} height={height} className="size-full object-cover" />
      )}
    </span>
  );
}

function Tile({ t, count, wide, className }: { t: HomeTile; count?: number; wide?: boolean; className?: string }) {
  return (
    <li className={className}>
      <Link
        href={`/catalog/${t.slug}`}
        className="group relative block h-[122px] overflow-hidden rounded-[8px] bg-surface pl-4 pr-2 pt-[14px] transition-shadow hover:shadow-card"
      >
        <TilePhoto t={t} />
        <span
          className={cn(
            "relative z-[1] line-clamp-2 block whitespace-pre-line hyphens-none break-words font-bold leading-[20px] text-black",
            wide ? "text-[13px] sm:text-[14px] xl:text-[16px]" : "text-[13px] sm:text-[14px] xl:text-[15px]",
          )}
          style={{ maxWidth: t.textW ?? (wide ? 181 : 153) }}
        >
          {t.name}
        </span>
        {count ? <span className="relative z-[1] mt-px block text-[13px] leading-[21px] text-sub">{countLabel(count, ["товар", "товара", "товаров"])}</span> : null}
      </Link>
    </li>
  );
}

/** Плитки категорий лендинга (Figma 10999:2865): набор и порядок — из макета, количество товаров — из каталога. */
export function CategoryTiles({ counts }: { counts: Record<string, number> }) {
  return (
    <section className="container-page mt-10 lg:mt-[60px]" aria-label="Популярные категории">
      <h2 className="sr-only">Популярные категории</h2>
      <ul className="grid grid-cols-2 gap-[13px] sm:grid-cols-3 lg:ml-px lg:grid-cols-6">
        {ROW1.map((t) => (
          <Tile key={t.slug} t={t} count={counts[t.slug]} />
        ))}
      </ul>
      <ul className="mt-[13px] grid grid-cols-2 gap-[13px] sm:grid-cols-3 lg:ml-px lg:mr-[2px] lg:grid-cols-5">
        {ROW2.map((t, i) => (
          // 11-я плитка на телефоне (2 колонки) осталась бы одна в ряду
          <Tile key={t.slug} t={t} count={counts[t.slug]} wide className={i === 4 ? "max-sm:hidden" : undefined} />
        ))}
      </ul>
    </section>
  );
}
