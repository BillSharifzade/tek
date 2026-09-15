import Link from "next/link";
import type { Metadata } from "next";
import { publicGet } from "@/lib/server";
import { date } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Pagination } from "@/components/ui/Pagination";
import type { ContentPaged, NewsEntry } from "@/components/content/types";

export const metadata: Metadata = { title: "Новости" };

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const data = await publicGet<ContentPaged<NewsEntry>>("/content/news", { page }, 120);

  return (
    <div className="container-page pb-14">
      <Breadcrumbs items={[{ label: "Новости" }]} />
      <h1>Новости</h1>
      {data.items.length > 0 ? (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {data.items.map((n) => (
            <li key={n.slug}>
              <article className="grid grid-cols-1 gap-2 py-5 md:grid-cols-[120px_minmax(0,1fr)] md:gap-6">
                <time dateTime={n.date} className="text-sm text-sub tnum md:pt-1">
                  {date(n.date)}
                </time>
                <div>
                  <h3 className="text-lg">
                    <Link href={`/news/${n.slug}`} className="hover:text-brand-hover">
                      {n.title}
                    </Link>
                  </h3>
                  <p className="mt-1.5 max-w-3xl text-base text-sub">{n.excerpt}</p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 rounded-[8px] border border-line bg-white p-8 text-center text-sub">Новостей пока нет.</p>
      )}
      <Pagination page={data.page} pages={data.pages} hrefFor={(p) => (p === 1 ? "/news" : `/news?page=${p}`)} className="mt-10" />
    </div>
  );
}
