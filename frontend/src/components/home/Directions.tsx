import Link from "next/link";
import { IconDirBox, IconDirGenerator, IconDirProfile, IconDirSolar } from "./icons";

interface Tile {
  href: string;
  title: string;
  text: string;
  icon: React.ReactNode;
  /** ширина описания (в макете у «Солнечной энергетики» 217, у остальных 230) */
  textW?: string;
}

const SMALL: Tile[] = [
  {
    href: "/services/podderzhka-v-proektirovanii",
    title: "Для проектировщиков",
    text: "Помощь в проектировании, чертежи, конфигураторы, обучение",
    icon: <IconDirProfile className="absolute left-[36px] top-[31px] text-black" />,
  },
  {
    href: "/configurators",
    title: "Конфигураторы",
    text: "Программы, онлайн конфигураторы и калькуляторы для электриков",
    icon: <IconDirBox className="absolute left-[35px] top-[29px] text-black" />,
  },
  {
    href: "/services/solnechnye-elektrostantsii",
    title: "Солнечная энергетика",
    text: "Проектирование, комплектация и монтаж солнечных электростанций",
    icon: <IconDirSolar width={52} height={65.7} className="absolute left-[39.5px] top-[25.6px]" />,
    textW: "xl:w-[217px]",
  },
  {
    href: "/services/obsluzhivanie-dgu-ibp",
    title: "Сервис центр генераторов",
    text: "Установка, обслуживание, диагностика и ремонт генераторов",
    icon: <IconDirGenerator className="absolute left-[35px] top-[31px]" />,
  },
];

const tile = "group relative block overflow-hidden rounded-[8px] bg-surface-2 transition-shadow hover:shadow-card";

/** Плитки направлений (Figma 10999:2827): большая 458×258 + четыре 385×122, зазоры 16/14. */
export function Directions() {
  return (
    <section className="container-page mt-10 lg:mt-[51px]" aria-label="Направления">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:ml-px xl:mr-[-1px] xl:grid-cols-[458fr_385fr_385fr] xl:grid-rows-[122px_122px] xl:gap-x-[16px] xl:gap-y-[14px]">
        <li className="sm:col-span-2 xl:col-span-1 xl:row-span-2">
          <Link href="/catalog" className={`${tile} h-full min-h-[258px] px-[30px] pb-6 pt-[123px]`}>
            <IconDirBox width={76} height={76} className="absolute left-[33px] top-[23px] text-black" />
            <span className="block text-[25px] font-bold leading-[35px] text-black xl:w-[394px]">Интернет-магазин электрики</span>
            <span className="mt-[7px] block max-w-[324px] text-[15px] leading-[22px] text-g333">
              Оптовый магазин высококачественной электрики с товарами известных производителей
            </span>
          </Link>
        </li>
        {SMALL.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className={`${tile} h-full min-h-[122px] pb-4 pl-[132px] pr-4 pt-[21px]`}>
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
