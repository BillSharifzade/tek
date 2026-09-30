import Link from "next/link";
import { cn } from "@/lib/cn";
import { IconTileBox, IconTileCalc, IconTileGenerator, IconTileProfile, IconTileSolar, IconTileSwitchboard } from "./icons";

export interface ServiceTile {
  slug: string;
  title: string;
  text: string;
}

const ICONS: Record<string, (p: { className?: string }) => React.ReactNode> = {
  "obsluzhivanie-dgu-ibp": (p) => <IconTileGenerator {...p} />,
  "solnechnye-elektrostantsii": (p) => <IconTileSolar {...p} />,
  "podderzhka-v-proektirovanii": (p) => <IconTileProfile {...p} />,
  "internet-magazin": (p) => <IconTileBox {...p} />,
  konfiguratory: (p) => <IconTileCalc {...p} />,
  "sborka-shchitovogo-oborudovaniya": (p) => <IconTileSwitchboard {...p} />,
};

const tile = "group relative block h-full overflow-hidden rounded-[8px] bg-surface-2 transition-shadow hover:shadow-card";

/**
 * Плитки услуг в языке плиток направлений лендинга (Figma 10999:2827):
 * #F7F8F9 r8; крупные — иконка 76, заголовок 25/35 Bold, текст 15/22 #333; малые 122px — иконка 60 слева, 16/20 Bold + 14/17 #666.
 */
export function ServiceTiles({ main, other }: { main: ServiceTile[]; other: ServiceTile[] }) {
  return (
    <div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-[16px] lg:gap-y-[14px]">
        {main.map((s) => {
          const Icon = ICONS[s.slug] ?? ICONS["internet-magazin"];
          return (
            <li key={s.slug}>
              <Link href={`/services/${s.slug}`} className={cn(tile, "min-h-[258px] px-[30px] pb-6 pt-[123px]")}>
                <span className="absolute left-[33px] top-[23px] grid size-[76px] place-items-center">
                  <Icon className="h-[76px] w-auto" />
                </span>
                <span className="block text-[25px] font-bold leading-[35px] text-black">{s.title}</span>
                <span className="mt-[7px] block max-w-[340px] text-[15px] leading-[22px] text-g333">{s.text}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {other.length > 0 ? (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:mt-[14px] lg:grid-cols-3 lg:gap-x-[16px] lg:gap-y-[14px]">
          {other.map((s) => {
            const Icon = ICONS[s.slug] ?? ICONS["internet-magazin"];
            return (
              <li key={s.slug}>
                <Link href={`/services/${s.slug}`} className={cn(tile, "min-h-[122px] pb-4 pl-[132px] pr-4 pt-[20px]")}>
                  <span className="absolute left-[35px] top-[31px] grid size-[60px] place-items-center">
                    <Icon className="h-[60px] w-auto" />
                  </span>
                  <span className="block text-[16px] font-bold leading-[20px] text-black">{s.title}</span>
                  <span className="mt-[5px] block max-w-[230px] text-[14px] leading-[17px] text-sub">{s.text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
