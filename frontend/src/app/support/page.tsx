import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheck, FileText } from "lucide-react";
import { publicGet, safe } from "@/lib/server";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Prose } from "@/components/content/Prose";
import { ConfiguratorCard } from "@/components/content/ConfiguratorCard";
import type { CmsPage, ConfiguratorItem } from "@/components/content/types";

export const metadata: Metadata = { title: "Поддержка" };

const CATALOGS: { title: string; meta: string }[] = [
  { title: "Каталог ДКС — кабеленесущие системы (PDF)", meta: "PDF · 48 МБ" },
  { title: "Каталог Schneider Electric — низковольтное оборудование", meta: "PDF · 31 МБ" },
  { title: "Каталог Philips Lighting", meta: "PDF · 22 МБ" },
  { title: "Прайс-лист ТЭК (XLSX)", meta: "XLSX · 1,2 МБ" },
];

export default async function SupportPage() {
  const [page, configurators] = await Promise.all([
    publicGet<CmsPage>("/content/pages/support", undefined, 300),
    safe(publicGet<ConfiguratorItem[]>("/content/configurators", undefined, 300), [] as ConfiguratorItem[]),
  ]);

  return (
    <div className="container-page pb-14">
      <Breadcrumbs items={[{ label: "Поддержка" }]} />
      <h1>{page.title}</h1>
      <Prose html={page.body_html} className="mt-4 max-w-3xl" />

      {configurators.length > 0 ? (
        <section className="mt-12" id="configurators">
          <div className="mb-6 flex items-end justify-between gap-3">
            <h2>Конфигураторы</h2>
            <Link href="/configurators" className="text-base font-medium hover:text-brand-hover">
              Все конфигураторы
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {configurators.map((c) => (
              <li key={c.slug}>
                <ConfiguratorCard item={c} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-12" id="catalogs">
        <h2 className="mb-6">Каталоги и брошюры</h2>
        <ul className="divide-y divide-line rounded-[8px] border border-line bg-white">
          {CATALOGS.map((c) => (
            <li key={c.title}>
              <a href="#" className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[6px] bg-brand-light text-brand-hover">
                  <FileText className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-medium">{c.title}</span>
                  <span className="block text-xs text-sub">{c.meta}</span>
                </span>
                <span className="text-sm font-medium text-info">Скачать</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" id="certificates">
        <div className="flex flex-col gap-4 rounded-[8px] border border-line bg-surface p-6 md:flex-row md:items-center">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-success">
            <BadgeCheck className="size-6" />
          </span>
          <div className="flex-1">
            <h3>Сертификаты</h3>
            <p className="mt-1 text-base text-sub">
              Сертификаты соответствия, декларации и чертежи доступны для скачивания в разделе «Документация» на странице каждого товара.
            </p>
          </div>
          <Link href="/catalog" className="text-base font-medium hover:text-brand-hover">
            Перейти в каталог
          </Link>
        </div>
      </section>
    </div>
  );
}
