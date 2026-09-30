import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { optional, publicGet } from "@/lib/server";
import { PageHead } from "@/components/content/PageHead";
import { TrayCalculator } from "@/components/content/TrayCalculator";
import { Note } from "@/components/content/Blocks";
import { CtaBand } from "@/components/content/CtaBand";
import type { ConfiguratorItem } from "@/components/content/types";

type Params = Promise<{ slug: string }>;

async function load(slug: string): Promise<ConfiguratorItem | null> {
  const all = await optional(publicGet<ConfiguratorItem[]>("/content/configurators", undefined, 300));
  return all?.find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const c = await load(slug);
  return { title: c?.name ?? "Конфигуратор", description: c?.description };
}

export default async function ConfiguratorPage({ params }: { params: Params }) {
  const { slug } = await params;
  const item = await load(slug);
  if (!item) notFound();
  const vendor = slug === "fix-combitech" ? "Fix Combitech" : null;

  return (
    <div className="container-page pb-[64px] md:pb-[100px]">
      <PageHead
        crumbs={[{ href: "/configurators", label: "Конфигураторы" }, { label: item.name }]}
        title={
          <span className="inline-flex flex-wrap items-center gap-x-[14px] gap-y-2">
            {item.name}
            {vendor ? <span className="inline-flex h-[25px] items-center rounded-[7px] bg-brand px-[8px] text-[14px] font-semibold leading-[13px] text-g333">{vendor}</span> : null}
          </span>
        }
      >
        <p className="mt-[12px] max-w-[860px] text-[15px] leading-[24px] text-g333 md:text-[16px] md:leading-[26px]">{item.description}</p>
      </PageHead>

      <div className="mt-[28px] md:mt-[40px]">
        <TrayCalculator />
      </div>

      <Note title="Расчёт предварительный" className="mt-[32px] md:mt-[40px]">
        Точную комплектацию с учётом нагрузки и способа монтажа подтвердит инженер ТЭК.
      </Note>

      <CtaBand className="mt-[56px] md:mt-[90px]" title="Отправить расчёт инженеру?" text="Проверим комплектацию, подберём артикулы в наличии на складе и подготовим коммерческое предложение." cta="Отправить заявку" />
    </div>
  );
}
