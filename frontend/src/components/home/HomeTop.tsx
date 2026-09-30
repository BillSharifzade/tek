import Image from "next/image";
import Link from "next/link";
import type { HomeNews } from "@/lib/types";
import { dateSlash } from "@/lib/format";
import { IconChevronTiny } from "./icons";

type NewsWithTags = HomeNews & { tags?: string[] | null };

/** API пока не отдаёт теги новостей — подбираем по ключевым словам заголовка (как «#семинар #тренинг» в макете). */
const TAG_RULES: [RegExp, string[]][] = [
  [/презентац|семинар|тренинг|обучени|вебинар/i, ["#семинар", "#тренинг"]],
  [/конфигуратор/i, ["#конфигураторы", "#сервис"]],
  [/склад|филиал|офис|магазин/i, ["#компания", "#доставка"]],
  [/электроснабжени|генератор|дгу|ибп/i, ["#проекты", "#ДГУ"]],
  [/солнечн|сэс/i, ["#проекты", "#СЭС"]],
];

function newsTags(n: NewsWithTags): string[] {
  if (n.tags && n.tags.length > 0) return n.tags.map((t) => (t.startsWith("#") ? t : `#${t}`));
  for (const [re, tags] of TAG_RULES) if (re.test(n.title)) return tags;
  return ["#новости"];
}

/** Первый экран лендинга: фото 888×439 + блок «Новости» 349×439 (Figma 10999:2804 / 10999:2806). */
export function HomeTop({ news }: { news: NewsWithTags[] }) {
  return (
    <section className="container-page mt-4 lg:mt-[31px]" aria-label="ТЭК — Точикэлектрокомплект">
      <div className="flex flex-col gap-4 lg:ml-px lg:grid lg:h-[439px] lg:grid-cols-[888fr_349fr] lg:gap-[22px]">
        <div className="relative aspect-[888/439] overflow-hidden rounded-[11px] bg-surface lg:aspect-auto lg:h-full">
          <Image
            src="/figma/hero-nurek.webp"
            alt="Нурекская ГЭС — энергетика Таджикистана"
            fill
            priority
            sizes="(min-width: 1292px) 888px, (min-width: 1024px) 70vw, 100vw"
            className="object-cover"
          />
        </div>

        <aside className="relative rounded-[11px] bg-surface-2 pb-6 pl-[28px] pr-[26px] pt-[23px] lg:pb-0" aria-labelledby="home-news-title">
          <h2 id="home-news-title" className="text-[20px] font-semibold leading-[22px] text-black">
            Новости
          </h2>
          <Link
            href="/news"
            className="link-hover absolute right-[25.6px] top-[30px] flex items-start gap-[6px] text-[13px] leading-[12px] text-g333 underline decoration-[#7C7E7E] decoration-1 hover:decoration-black"
          >
            Все новости
            <IconChevronTiny className="mt-[2.6px] text-[#5F6061]" />
          </Link>

          <ul className="mt-[22px] lg:w-[295px]">
            {news.slice(0, 3).map((n, i) => (
              <li key={n.slug} className={i > 0 ? "mt-[16px] border-t border-[#E0E4EA] pt-[17px]" : undefined}>
                <Link href={`/news/${n.slug}`} className="group block pr-[6px]">
                  <time dateTime={n.date} className="block text-[13px] leading-[20px] text-muted tnum">
                    {dateSlash(n.date)}
                  </time>
                  <span className="mt-[3px] line-clamp-2 lg:h-[40px] text-[15px] font-medium leading-[20px] text-black transition-colors group-hover:text-black">
                    {n.title}
                  </span>
                  <span className="mt-[8px] block whitespace-pre text-[13px] leading-[20px] text-muted">{newsTags(n).join("    ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
