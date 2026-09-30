import type { Metadata } from "next";
import { publicGet } from "@/lib/server";
import { countLabel } from "@/lib/format";
import { Pagination } from "@/components/ui/Pagination";
import { PageHead } from "@/components/content/PageHead";
import { NewsCard } from "@/components/content/NewsCard";
import { CtaBand } from "@/components/content/CtaBand";
import type { ContentPaged, NewsEntry } from "@/components/content/types";

export const metadata: Metadata = { title: "Новости" };

const PER_PAGE = 9;

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const data = await publicGet<ContentPaged<NewsEntry>>("/content/news", { page, per_page: PER_PAGE }, 120);

  return (
    <div className="container-page pb-[64px] md:pb-[100px]">
      <PageHead
        crumbs={[{ href: "/about", label: "О компании" }, { label: "Новости" }]}
        title="Новости"
        aside={<span className="text-[14px] leading-[20px] text-muted tnum">{countLabel(data.total, ["новость", "новости", "новостей"])}</span>}
      >
        <p className="mt-[12px] max-w-[720px] text-[15px] leading-[24px] text-g333 md:text-[16px] md:leading-[26px]">
          События компании, запуски сервисов, реализованные проекты, семинары и обучение от производителей.
        </p>
      </PageHead>

      {data.items.length > 0 ? (
        <ul className="mt-[32px] grid grid-cols-1 gap-[20px] sm:grid-cols-2 md:mt-[40px] lg:grid-cols-3 lg:gap-x-[34px] lg:gap-y-[34px]">
          {data.items.map((n, i) => (
            <li key={n.slug}>
              <NewsCard item={n} priority={i < 3} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-[40px] rounded-[11px] bg-surface-2 px-6 py-16 text-center text-[16px] text-sub">Новостей пока нет.</p>
      )}
      <Pagination page={data.page} pages={data.pages} hrefFor={(p) => (p === 1 ? "/news" : `/news?page=${p}`)} className="mt-[48px]" />

      <CtaBand className="mt-[64px] md:mt-[100px]" />
    </div>
  );
}
