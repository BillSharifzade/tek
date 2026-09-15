import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import type { Brand } from "@/lib/types";
import { publicGet, safe } from "@/lib/server";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ImageBox } from "@/components/ui/ImageBox";
import { Prose } from "@/components/content/Prose";
import { CtaBand } from "@/components/content/CtaBand";
import type { CmsPage } from "@/components/content/types";

export const metadata: Metadata = { title: "О компании" };

const FACTS: { value: string; label: string }[] = [
  { value: "с 2009", label: "года на рынке Таджикистана" },
  { value: "3000 м²", label: "собственный склад в Душанбе" },
  { value: "2 города", label: "Душанбе · Худжанд" },
  { value: "48 часов", label: "доставка по всей стране" },
];

export default async function AboutPage() {
  const [page, brands] = await Promise.all([
    publicGet<CmsPage>("/content/pages/about", undefined, 300),
    safe(publicGet<Brand[]>("/brands", undefined, 300), [] as Brand[]),
  ]);
  const featured = brands.filter((b) => b.is_featured);

  return (
    <div className="container-page pb-14">
      <Breadcrumbs items={[{ label: page.title }]} />
      <h1>{page.title}</h1>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Prose html={page.body_html} />
        <aside className="grid grid-cols-2 gap-4 self-start lg:grid-cols-1">
          {FACTS.map((f) => (
            <div key={f.value} className="rounded-[8px] border border-line bg-white p-5">
              <p className="text-3xl font-semibold text-brand-hover tnum">{f.value}</p>
              <p className="mt-1 text-sm text-sub">{f.label}</p>
            </div>
          ))}
        </aside>
      </div>

      {featured.length > 0 ? (
        <section className="mt-14">
          <div className="mb-6 flex items-end justify-between gap-3">
            <h2>Бренды-партнёры</h2>
            <Link href="/brands" className="inline-flex items-center gap-1 text-base font-medium hover:text-brand-hover">
              Все бренды
              <ChevronRight className="size-4" />
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            {featured.map((b) => (
              <li key={b.slug}>
                <Link href={`/brands/${b.slug}`} className="flex h-24 items-center justify-center rounded-[8px] border border-line bg-white p-2 transition-colors hover:border-brand" title={b.name}>
                  <ImageBox src={b.logo} alt={b.name} className="h-full w-full" sizes="160px" rounded="rounded-none" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <CtaBand className="mt-14" />
    </div>
  );
}
