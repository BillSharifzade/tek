import Image from "next/image";
import Link from "next/link";
import { IconTileCalc } from "@/components/services/icons";
import { IconDirDesigner, IconDirService } from "./icons";

export interface DirectionTileData {
  href: string;
  title: string;
  text: string;
  /** иконка 61×61 слева */
  icon: React.ReactNode;
  /** ширина описания (в макете у «Солнечной энергетики» 217, у остальных 230) */
  textW?: string;
}

/** Направления-услуги: на лендинге и (компактными плитками) на странице «Все услуги». */
export const SERVICE_DIRECTIONS: Record<"solar" | "generators" | "designers", DirectionTileData> = {
  solar: {
    href: "/services/solnechnye-elektrostantsii",
    title: "Солнечная энергетика",
    text: "Проектирование, комплектация и монтаж солнечных электростанций",
    textW: "xl:w-[217px]",
    // Figma «solar-panel-30-percent-thinner» 11083:2239 (редакция 06.10): 65×65 с (33,29)
    icon: <Image src="/figma/icons/dir-solar.svg" alt="" width={65} height={65} className="absolute left-[33px] top-[29px] size-[65px]" />,
  },
  generators: {
    href: "/services/obsluzhivanie-dgu-ibp",
    title: "Сервис центр генераторов",
    text: "Установка, обслуживание, диагностика и ремонт генераторов",
    icon: <IconDirService className="absolute left-[35px] top-[31px]" />,
  },
  // доработки R2: «Для проектировщиков» — страница /support
  designers: {
    href: "/support",
    title: "Для проектировщиков",
    text: "Помощь в проектировании, чертежи, конфигураторы, обучение",
    icon: <IconDirDesigner className="absolute left-[37px] top-[30px]" />,
  },
};

/** Порядок = порядок в сетке: верхний ряд (y=761), затем нижний (y=897). */
const SMALL: DirectionTileData[] = [
  SERVICE_DIRECTIONS.solar,
  SERVICE_DIRECTIONS.generators,
  SERVICE_DIRECTIONS.designers,
  {
    href: "/configurators",
    title: "Конфигураторы",
    text: "Программы, онлайн конфигураторы и калькуляторы для электриков",
    // калькулятор со страницы «Все услуги» (по просьбе клиента вместо шестерёнок), 61×61 как остальные иконки плиток
    icon: <IconTileCalc className="absolute left-[36px] top-[30px] size-[61px]" />,
  },
];

/** При наведении плитка из серой становится белой (с тенью). */
const tile = "group relative block overflow-hidden rounded-[8px] bg-surface-2 transition-[background-color,box-shadow] hover:bg-white hover:shadow-card";

/** Компактная плитка направления 385×122: иконка 61 слева, заголовок 16/20 Bold, описание 14/17 #666. */
export function DirectionTile({ t }: { t: DirectionTileData }) {
  return (
    <Link href={t.href} className={`${tile} h-full min-h-[122px] pb-4 pl-[132px] pr-4 pt-[23px]`}>
      {t.icon}
      <span className="block text-[16px] font-bold leading-[20px] text-black">{t.title}</span>
      <span className={`mt-[5px] block max-w-[230px] text-[14px] leading-[17px] text-sub ${t.textW ?? ""}`}>{t.text}</span>
    </Link>
  );
}

/**
 * Плитки направлений (Figma «Сервисы» 10999:2827, редакция 06.10): большая 458×258 + четыре 385×122, зазоры 16/14.
 * Большая: заголовок 25/33 Bold в рамке 369 (3 строки) с (30,34), описание 15/22 #333 шириной 247 с y=155, иллюстрация 131×131 (297,98).
 * Малые: заголовок 16/20 Bold с (132,23), описание 14/17 #666 с y=48, иконка 61×61 слева.
 */
export function Directions() {
  return (
    <section className="container-page mt-10 lg:mt-[51px]" aria-label="Направления">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:ml-px xl:mr-[-1px] xl:grid-cols-[458fr_385fr_385fr] xl:grid-rows-[122px_122px] xl:gap-x-[16px] xl:gap-y-[14px]">
        <li className="sm:col-span-2 xl:col-span-1 xl:row-span-2">
          {/* Figma 10999:2828 (редакция 06.10): заголовок с (30,34), описание 247 с y=155, иллюстрация 131×131 с (297,98) */}
          <Link href="/catalog" className={`${tile} h-full min-h-[258px] pb-6 pl-[24px] pr-[96px] pt-[24px] sm:pl-[30px] sm:pr-[30px] sm:pt-[34px]`}>
            <Image
              src="/figma/icons/dir-shop.svg"
              alt=""
              width={131}
              height={131}
              className="absolute right-[12px] top-[20px] size-[76px] sm:right-[30px] sm:top-[98px] sm:size-[131px]"
            />
            <span className="block text-[22px] font-bold leading-[29px] text-black sm:w-[369px] sm:text-[25px] sm:leading-[33px]">
              Интернет-магазин электротехнической продукции
            </span>
            <span className="mt-[15px] block max-w-[247px] text-[15px] leading-[22px] text-g333 sm:mt-[22px]">
              Высококачественная электрика от известных производителей
            </span>
          </Link>
        </li>
        {SMALL.map((t) => (
          <li key={t.href}>
            <DirectionTile t={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}
