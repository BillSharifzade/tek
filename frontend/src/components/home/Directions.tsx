import Link from "next/link";
import { IconDirCart, IconDirConfig, IconDirDesigner, IconDirService } from "./icons";

interface Tile {
  href: string;
  title: string;
  text: string;
  /** иконка 61×61; у «Солнечной энергетики» в макете (редакция 30.09) иконки нет */
  icon?: React.ReactNode;
  /** ширина описания (в макете у «Солнечной энергетики» 217, у остальных 230) */
  textW?: string;
}

/** Порядок = порядок в сетке: верхний ряд (y=761), затем нижний (y=897). */
const SMALL: Tile[] = [
  {
    href: "/services/solnechnye-elektrostantsii",
    title: "Солнечная энергетика",
    text: "Проектирование, комплектация и монтаж солнечных электростанций",
    textW: "xl:w-[217px]",
  },
  {
    href: "/services/obsluzhivanie-dgu-ibp",
    title: "Сервис центр генераторов",
    text: "Установка, обслуживание, диагностика и ремонт генераторов",
    icon: <IconDirService className="absolute left-[35px] top-[31px]" />,
  },
  {
    href: "/services/podderzhka-v-proektirovanii",
    title: "Для проектировщиков",
    text: "Помощь в проектировании, чертежи, конфигураторы, обучение",
    icon: <IconDirDesigner className="absolute left-[37px] top-[30px]" />,
  },
  {
    href: "/configurators",
    title: "Конфигураторы",
    text: "Программы, онлайн конфигураторы и калькуляторы для электриков",
    icon: <IconDirConfig className="absolute left-[36px] top-[30px]" />,
  },
];

const tile = "group relative block overflow-hidden rounded-[8px] bg-surface-2 transition-shadow hover:shadow-card";

/**
 * Плитки направлений (Figma «Сервисы» 10999:2827, редакция 30.09): большая 458×258 + четыре 385×122, зазоры 16/14.
 * Большая: заголовок 25/33 Bold в рамке 369 (3 строки) с (30,28), описание 15/22 #333 с y=142, тележка 94×94 справа (320,72).
 * Малые: заголовок 16/20 Bold с (132,23), описание 14/17 #666 с y=48, иконка 61×61 слева.
 */
export function Directions() {
  return (
    <section className="container-page mt-10 lg:mt-[51px]" aria-label="Направления">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:ml-px xl:mr-[-1px] xl:grid-cols-[458fr_385fr_385fr] xl:grid-rows-[122px_122px] xl:gap-x-[16px] xl:gap-y-[14px]">
        <li className="sm:col-span-2 xl:col-span-1 xl:row-span-2">
          <Link href="/catalog" className={`${tile} h-full min-h-[258px] pb-6 pl-[24px] pr-[96px] pt-[24px] sm:pl-[30px] sm:pr-[30px] sm:pt-[28px]`}>
            <IconDirCart className="absolute right-[20px] top-[22px] size-[64px] text-black sm:right-[44px] sm:top-[72px] sm:size-[94px]" />
            <span className="block text-[22px] font-bold leading-[29px] text-black sm:w-[369px] sm:text-[25px] sm:leading-[33px]">
              Интернет-магазин электротехнической продукции
            </span>
            <span className="mt-[15px] block max-w-[324px] text-[15px] leading-[22px] text-g333">
              Оптовый магазин высококачественной электрики с товарами известных производителей
            </span>
          </Link>
        </li>
        {SMALL.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className={`${tile} h-full min-h-[122px] pb-4 pl-[132px] pr-4 pt-[23px]`}>
              {t.icon}
              <span className="block text-[16px] font-bold leading-[20px] text-black">{t.title}</span>
              <span className={`mt-[5px] block max-w-[230px] text-[14px] leading-[17px] text-sub ${t.textW ?? ""}`}>{t.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
