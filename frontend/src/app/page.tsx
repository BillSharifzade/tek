import Link from "next/link";
import { ChevronRight, Truck, Headset, ShieldCheck, Wrench, Zap, BadgeCheck, type LucideIcon } from "lucide-react";
import type { Home } from "@/lib/types";
import { personalizedGet } from "@/lib/server";
import { countLabel, date } from "@/lib/format";
import { Hero } from "@/components/home/Hero";
import { PopularProducts } from "@/components/home/PopularProducts";
import { ImageBox } from "@/components/ui/ImageBox";
import { Section, SectionHeader } from "@/components/ui/Section";

const USP_ICONS: Record<string, LucideIcon> = {
  truck: Truck,
  support: Headset,
  shield: ShieldCheck,
  wrench: Wrench,
  zap: Zap,
  check: BadgeCheck,
};

function uspIcon(name: string, i: number): LucideIcon {
  return USP_ICONS[name] ?? [Truck, Headset, ShieldCheck, Wrench][i % 4];
}

export default async function HomePage() {
  const home = await personalizedGet<Home>("/home");

  return (
    <>
      <Hero banners={home.banners} />

      {home.usp.length > 0 ? (
        <section className="container-page mt-8" aria-label="Преимущества">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {home.usp.slice(0, 4).map((u, i) => {
              const Icon = uspIcon(u.icon, i);
              return (
                <li key={u.title} className="flex items-start gap-4 rounded-[8px] border border-line bg-white p-5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-ink">
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className="block text-base font-semibold leading-5">{u.title}</span>
                    {u.text ? <span className="mt-1 block text-sm text-sub">{u.text}</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <Section>
        <SectionHeader title="Популярные категории" href="/catalog" linkLabel="Весь каталог" />
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {home.popular_categories.slice(0, 6).map((c) => (
            <li key={c.slug}>
              <Link href={`/catalog/${c.slug}`} className="group flex h-full flex-col rounded-[8px] border border-line bg-white p-4 transition-shadow hover:shadow-card">
                <ImageBox src={c.image} alt={c.name} className="aspect-[4/3] w-full" sizes="(max-width: 768px) 50vw, 200px" />
                <span className="mt-3 text-base font-semibold leading-5 group-hover:text-brand-hover">{c.name}</span>
                <span className="mt-1 text-sm text-sub">{countLabel(c.product_count, ["товар", "товара", "товаров"])}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <div className="grid grid-cols-1 gap-6 rounded-[8px] border border-line bg-surface-2 p-6 md:grid-cols-[300px_1fr] md:p-8">
          <div>
            <h2 className="text-2xl font-semibold">Бренды</h2>
            <p className="mt-3 text-base text-sub">
              Широкий выбор оригинальной продукции ведущих мировых производителей электротехнической продукции.
            </p>
            <Link href="/brands" className="mt-5 inline-flex items-center gap-1 text-base font-medium hover:text-brand-hover">
              Все бренды
              <ChevronRight className="size-4" />
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {home.brands.slice(0, 8).map((b) => (
              <li key={b.slug}>
                <Link href={`/brands/${b.slug}`} className="flex h-[72px] items-center justify-center rounded-[8px] border border-line bg-white px-4 text-center text-base font-semibold transition-colors hover:border-brand" title={b.name}>
                  {b.logo ? <ImageBox src={b.logo} alt={b.name} className="h-10 w-full" sizes="160px" rounded="rounded-none" /> : <span className="line-clamp-2">{b.name}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section>
        <PopularProducts popular={home.popular_products} fresh={home.new_products} />
      </Section>

      <Section>
        <SectionHeader title="Услуги" href="/services" linkLabel="Все услуги" />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {home.services.slice(0, 6).map((s) => (
            <li key={s.slug}>
              <Link href={`/services/${s.slug}`} className="group flex h-full gap-4 rounded-[8px] border border-line bg-white p-5 transition-shadow hover:shadow-card">
                <ImageBox src={s.image} alt={s.title} className="size-16 shrink-0" sizes="64px" />
                <span className="min-w-0">
                  <span className="block text-base font-semibold leading-5 group-hover:text-brand-hover">{s.title}</span>
                  <span className="mt-1 line-clamp-2 block text-sm text-sub">{s.short}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
          <div>
            <SectionHeader title="Реализованные проекты" href="/projects" linkLabel="Все проекты" />
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {home.projects.slice(0, 3).map((p) => (
                <li key={p.slug}>
                  <Link href={`/projects/${p.slug}`} className="group flex h-full flex-col rounded-[8px] border border-line bg-white p-4 transition-shadow hover:shadow-card">
                    <ImageBox src={p.image} alt={p.title} label={p.title} className="aspect-[16/10] w-full" fit="cover" sizes="(max-width: 640px) 100vw, 260px" />
                    <span className="mt-3 line-clamp-2 text-base font-semibold leading-5 group-hover:text-brand-hover">{p.title}</span>
                    <span className="mt-1 inline-flex w-fit rounded-full bg-brand-light px-2 py-0.5 text-xs font-semibold text-ink tnum">{p.year}</span>
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-line pt-3 text-sm">
                      <dt className="text-sub">Объект</dt>
                      <dd className="line-clamp-1 font-medium">{p.object}</dd>
                      <dt className="text-sub">Услуга</dt>
                      <dd className="line-clamp-1 font-medium">{p.service}</dd>
                    </dl>
                    <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-medium">
                      Подробнее
                      <ChevronRight className="size-4" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHeader title="Новости" href="/news" linkLabel="Все новости" />
            <ul className="flex flex-col divide-y divide-line rounded-[8px] border border-line bg-white">
              {home.news.slice(0, 5).map((n) => (
                <li key={n.slug}>
                  <Link href={`/news/${n.slug}`} className="group flex gap-3 px-5 py-4">
                    <span className="mt-0.5 text-brand-hover">&gt;</span>
                    <span>
                      <span className="block text-base font-medium leading-5 group-hover:text-brand-hover">{n.title}</span>
                      <span className="mt-1 block text-sm text-sub tnum">{date(n.date)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
    </>
  );
}
