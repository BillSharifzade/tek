import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronRight, Mail, Phone } from "lucide-react";
import { optional, publicGet, safe } from "@/lib/server";
import { SITE } from "@/lib/site";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { Prose } from "@/components/content/Prose";
import { ContentHero } from "@/components/content/ContentHero";
import { imageOf, type ServiceItem } from "@/components/content/types";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const s = await optional(publicGet<ServiceItem>(`/content/services/${slug}`, undefined, 300));
  return { title: s?.title ?? "Услуга" };
}

export default async function ServicePage({ params }: { params: Params }) {
  const { slug } = await params;
  const [service, all] = await Promise.all([
    optional(publicGet<ServiceItem>(`/content/services/${slug}`, undefined, 300)),
    safe(publicGet<ServiceItem[]>("/content/services", undefined, 300), [] as ServiceItem[]),
  ]);
  if (!service) notFound();
  const others = all.filter((s) => s.slug !== service.slug);

  return (
    <div className="container-page pb-14">
      <Breadcrumbs items={[{ href: "/services", label: "Услуги" }, { label: service.title }]} />
      <h1>{service.title}</h1>
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <ContentHero src={imageOf(service)} alt={service.title} />
          <Prose html={service.body} className="mt-8" />
        </div>
        <aside className="flex flex-col gap-5 self-start lg:sticky lg:top-24">
          <div className="rounded-[8px] border border-line bg-white p-6">
            <h3>Оставить заявку</h3>
            <p className="mt-1 text-sm text-sub">Ответим в течение одного рабочего дня</p>
            <ul className="mt-4 flex flex-col gap-2.5 text-base">
              <li>
                <a href={SITE.phoneHref} className="inline-flex items-center gap-2 font-medium hover:text-brand-hover">
                  <Phone className="size-4 text-sub" />
                  {SITE.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${SITE.email}`} className="inline-flex items-center gap-2 font-medium hover:text-brand-hover">
                  <Mail className="size-4 text-sub" />
                  {SITE.email}
                </a>
              </li>
            </ul>
            <ButtonLink href={`mailto:${SITE.email}?subject=${encodeURIComponent(`Заявка: ${service.title}`)}`} full className="mt-5">
              Написать нам
            </ButtonLink>
          </div>
          {others.length > 0 ? (
            <div className="rounded-[8px] border border-line bg-white p-6">
              <h3>Другие услуги</h3>
              <ul className="mt-3 divide-y divide-line">
                {others.map((s) => (
                  <li key={s.slug}>
                    <Link href={`/services/${s.slug}`} className="flex items-center justify-between gap-3 py-2.5 text-base hover:text-brand-hover">
                      <span>{s.title}</span>
                      <ChevronRight className="size-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
