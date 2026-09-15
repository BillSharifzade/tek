import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { optional, publicGet } from "@/lib/server";
import { date } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Prose } from "@/components/content/Prose";
import { ContentHero } from "@/components/content/ContentHero";
import { imageOf, type NewsEntry } from "@/components/content/types";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const n = await optional(publicGet<NewsEntry>(`/content/news/${slug}`, undefined, 120));
  return { title: n?.title ?? "Новость" };
}

export default async function NewsArticlePage({ params }: { params: Params }) {
  const { slug } = await params;
  const item = await optional(publicGet<NewsEntry>(`/content/news/${slug}`, undefined, 120));
  if (!item) notFound();

  return (
    <div className="container-page pb-14">
      <Breadcrumbs items={[{ href: "/news", label: "Новости" }, { label: item.title }]} />
      <article className="mx-auto max-w-3xl">
        <time dateTime={item.date} className="text-sm text-sub tnum">
          {date(item.date)}
        </time>
        <h1 className="mt-2">{item.title}</h1>
        <ContentHero src={imageOf(item)} alt={item.title} className="mt-6 aspect-[16/7]" />
        {item.body ? <Prose html={item.body} className="mt-8" /> : <p className="mt-8 text-md">{item.excerpt}</p>}
        <Link href="/news" className="mt-8 inline-flex items-center gap-2 text-base font-medium hover:text-brand-hover">
          <ArrowLeft className="size-4" />
          Все новости
        </Link>
      </article>
    </div>
  );
}
