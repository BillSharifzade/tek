import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { optional, publicGet, safe } from "@/lib/server";
import { dateSlash } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Prose } from "@/components/content/Prose";
import { CtaBand } from "@/components/content/CtaBand";
import { NewsRow, NewsTags } from "@/components/content/NewsCard";
import { IconArrowSmall } from "@/components/content/icons";
import { newsCover, newsTags } from "@/components/content/news";
import type { ContentPaged, NewsEntry } from "@/components/content/types";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const n = await optional(publicGet<NewsEntry>(`/content/news/${slug}`, undefined, 120));
  return { title: n?.title ?? "Новость", description: n?.excerpt };
}

export default async function NewsArticlePage({ params }: { params: Params }) {
  const { slug } = await params;
  const [item, list] = await Promise.all([
    optional(publicGet<NewsEntry>(`/content/news/${slug}`, undefined, 120)),
    safe(publicGet<ContentPaged<NewsEntry>>("/content/news", { page: 1, per_page: 5 }, 120), null),
  ]);
  if (!item) notFound();
  const others = (list?.items ?? []).filter((n) => n.slug !== item.slug).slice(0, 4);
  const cover = newsCover(item);
  // в CMS первый абзац тела часто повторяет анонс — тогда лид не выводим
  const plainBody = (item.body ?? "").replace(/<[^>]+>/g, " ");
  const showLead = Boolean(item.excerpt) && !plainBody.includes(item.excerpt.trim());

  return (
    <div className="container-page pb-[64px] md:pb-[100px]">
      <div className="pt-[24px] md:pt-[43px]">
        <Breadcrumbs items={[{ href: "/about", label: "О компании" }, { href: "/news", label: "Новости" }, { label: item.title }]} />
      </div>

      <div className="mt-[24px] grid grid-cols-1 gap-[40px] md:mt-[32px] lg:grid-cols-[minmax(0,1fr)_349px] lg:gap-[60px]">
        <article className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-[20px] gap-y-1">
            <time dateTime={item.date} className="text-[13px] leading-[20px] text-muted tnum">
              {dateSlash(item.date)}
            </time>
            <NewsTags tags={newsTags(item)} />
          </div>
          <h1 className="mt-[10px] text-[26px] font-bold leading-[32px] md:text-[32px] md:leading-[40px]">{item.title}</h1>
          {showLead ? <p className="mt-[16px] text-[16px] leading-[26px] text-g333 md:text-[18px] md:leading-[28px]">{item.excerpt}</p> : null}

          <div className={cn("relative mt-[28px] h-[240px] overflow-hidden rounded-[11px] md:h-[440px]", "bg-surface")}>
            <Image src={cover.src} alt={item.title} fill priority sizes="(max-width: 1024px) 100vw, 851px" className={cover.contain ? "object-contain p-10 mix-blend-multiply" : "object-cover"} />
          </div>

          {item.body ? <Prose html={item.body} className="mt-[32px]" /> : null}

          <Link href="/news" className="mt-[40px] inline-flex items-center gap-[6px] text-[14px] leading-[20px] text-g333 underline underline-offset-[3px] transition-colors hover:text-black">
            <IconArrowSmall className="size-[11px] rotate-180" />
            Все новости
          </Link>
        </article>

        {others.length > 0 ? (
          <aside className="self-start rounded-[11px] bg-surface-2 px-[28px] pb-[28px] pt-[23px] lg:sticky lg:top-[130px]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[20px] font-semibold leading-[22px]">Другие новости</h2>
              <Link href="/news" className="inline-flex items-center gap-[5px] text-[13px] leading-[12px] text-g333 underline underline-offset-2 transition-colors hover:text-black">
                Все новости
                <IconArrowSmall className="size-[11px] text-[#5F6061]" />
              </Link>
            </div>
            <div className="mt-[24px] divide-y divide-[#D9DDE4]">
              {others.map((n) => (
                <NewsRow key={n.slug} item={n} />
              ))}
            </div>
          </aside>
        ) : null}
      </div>

      <CtaBand className="mt-[64px] md:mt-[100px]" />
    </div>
  );
}
