import Link from "next/link";
import Image from "next/image";
import { dateSlash } from "@/lib/format";
import { cn } from "@/lib/cn";
import { newsCover, newsTags } from "./news";
import type { NewsEntry } from "./types";

/** Метаданные новости как на лендинге (10999:2806): дата 13px #808080 · заголовок Medium · теги «#семинар». */
export function NewsTags({ tags, className }: { tags: string[]; className?: string }) {
  return (
    <p className={cn("flex flex-wrap gap-x-[14px] text-[13px] leading-[20px] text-muted", className)}>
      {tags.map((t) => (
        <span key={t}>#{t}</span>
      ))}
    </p>
  );
}

/** Карточка новости: серая плашка #F7F8F9 r11 (как блок «Новости» лендинга) + фото 256px сверху. */
export function NewsCard({ item, priority }: { item: NewsEntry; priority?: boolean }) {
  const cover = newsCover(item);
  const href = `/news/${item.slug}`;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[11px] bg-surface-2 transition-shadow hover:shadow-pop">
      <div className={cn("relative h-[220px] w-full shrink-0 overflow-hidden md:h-[256px]", "bg-surface")}>
        <Image
          src={cover.src}
          alt=""
          fill
          unoptimized
          priority={priority}
          sizes="(max-width: 768px) 100vw, 397px"
          className={cn("transition-transform duration-300 group-hover:scale-[1.03]", cover.contain ? "object-contain p-6 mix-blend-multiply" : "object-cover")}
        />
      </div>
      <div className="flex flex-1 flex-col px-[24px] pb-[24px] pt-[20px] md:px-[28px] md:pb-[26px]">
        <time dateTime={item.date} className="text-[13px] leading-[20px] text-muted tnum">
          {dateSlash(item.date)}
        </time>
        <h3 className="mt-[6px] text-[16px] font-medium leading-[22px] text-black">
          <Link href={href} className="after:absolute after:inset-0 after:content-['']">
            {item.title}
          </Link>
        </h3>
        {item.excerpt ? <p className="mt-[8px] line-clamp-3 text-[14px] leading-[20px] text-sub">{item.excerpt}</p> : null}
        <NewsTags tags={newsTags(item)} className="mt-auto pt-[14px]" />
      </div>
    </article>
  );
}

/** Строка новости для боковой колонки (как в блоке «Новости» лендинга: 289px, разделители #D9DDE4). */
export function NewsRow({ item }: { item: NewsEntry }) {
  return (
    <article className="relative py-[17px] first:pt-0 last:pb-0">
      <time dateTime={item.date} className="block text-[13px] leading-[20px] text-muted tnum">
        {dateSlash(item.date)}
      </time>
      <h3 className="mt-[5px] text-[15px] font-medium leading-[20px] text-black">
        <Link href={`/news/${item.slug}`} className="link-hover after:absolute after:inset-0 after:content-[''] hover:underline">
          {item.title}
        </Link>
      </h3>
      <NewsTags tags={newsTags(item)} className="mt-[8px]" />
    </article>
  );
}
