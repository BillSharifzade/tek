import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { optional, publicGet } from "@/lib/server";
import type { ServiceItem } from "@/components/content/types";
import { configFromApi, SERVICE_CONFIGS } from "@/components/services/data";
import { ServiceTemplate } from "@/components/services/ServiceTemplate";
import type { ServiceConfig } from "@/components/services/types";

type Params = Promise<{ slug: string }>;

/** Конфиг страницы: свои тексты для услуг из ТЗ, для остальных — данные CMS в том же шаблоне. */
async function loadConfig(slug: string): Promise<ServiceConfig | null> {
  const own = SERVICE_CONFIGS[slug];
  if (own) return own;
  const s = await optional(publicGet<ServiceItem>(`/content/services/${encodeURIComponent(slug)}`, undefined, 300));
  return s ? configFromApi(s) : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const c = await loadConfig(slug);
  if (!c) notFound();
  return { title: c.title, description: c.description };
}

export default async function ServicePage({ params }: { params: Params }) {
  const { slug } = await params;
  const config = await loadConfig(slug);
  if (!config) notFound();
  return <ServiceTemplate config={config} />;
}
