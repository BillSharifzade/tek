import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { optional, publicGet } from "@/lib/server";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { TrayCalculator } from "@/components/content/TrayCalculator";
import type { ConfiguratorItem } from "@/components/content/types";

type Params = Promise<{ slug: string }>;

async function load(slug: string): Promise<ConfiguratorItem | null> {
  const all = await optional(publicGet<ConfiguratorItem[]>("/content/configurators", undefined, 300));
  return all?.find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const c = await load(slug);
  return { title: c?.name ?? "Конфигуратор" };
}

export default async function ConfiguratorPage({ params }: { params: Params }) {
  const { slug } = await params;
  const item = await load(slug);
  if (!item) notFound();

  return (
    <div className="container-page pb-14">
      <Breadcrumbs items={[{ href: "/configurators", label: "Конфигураторы" }, { label: item.name }]} />
      <div className="flex flex-wrap items-center gap-3">
        <h1>{item.name}</h1>
        <span className="inline-flex h-7 items-center rounded-full bg-brand px-3 text-sm font-semibold">Fix Combitech</span>
      </div>
      <p className="mt-2 max-w-3xl text-md text-sub">{item.description}</p>
      <div className="mt-8">
        <TrayCalculator />
      </div>
    </div>
  );
}
