import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import type { Brand, CategoryNode } from "@/lib/types";
import { publicGet, safe } from "@/lib/server";
import { countLabel } from "@/lib/format";
import { ButtonLink } from "@/components/ui/Button";
import { IconCheckGreen } from "@/components/icons/figma";
import { PageHead, SectionTitle, Lead } from "@/components/content/PageHead";
import { Prose } from "@/components/content/Prose";
import { CtaBand } from "@/components/content/CtaBand";
import { AnchorTabs } from "@/components/content/AnchorTabs";
import { IconArrowSmall } from "@/components/content/icons";
import { brandLogo, CERTIFICATES, CLIENTS } from "@/components/content/brands";
import type { CmsPage } from "@/components/content/types";
import { ADVANTAGES, FACTS, HIGHLIGHTS, RANGE } from "./data";
import { asset } from "@/lib/asset";

export const metadata: Metadata = {
  title: "О компании",
  description: "ТЭК — дистрибьютор электротехнической продукции в Таджикистане: партнёры, сертификаты дистрибьютора, клиенты.",
};

const TABS = [
  { id: "company", label: "О компании" },
  { id: "partners", label: "Бренды-партнёры" },
  { id: "certificates", label: "Сертификаты" },
  { id: "clients", label: "Нам доверяют" },
];

function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-[5px] text-[14px] leading-[20px] text-g333 underline underline-offset-[3px] transition-colors hover:text-black">
      {children}
      <IconArrowSmall className="size-[11px]" />
    </Link>
  );
}

export default async function AboutPage() {
  const [page, brands, tree] = await Promise.all([
    // текст «О нас» — из CMS; пустая база (SEED_DEMO=off) не должна ронять страницу
    safe(publicGet<CmsPage>("/content/pages/about", undefined, 300), null),
    safe(publicGet<Brand[]>("/brands", undefined, 300), [] as Brand[]),
    safe(publicGet<CategoryNode[]>("/catalog/tree", undefined, 300), [] as CategoryNode[]),
  ]);
  const partners = brands.filter((b) => b.is_featured);
  const counts = new Map(tree.map((c) => [c.slug, c.product_count]));

  return (
    <div className="pb-[64px] md:pb-[100px]">
      <div className="container-page">
        <PageHead crumbs={[{ label: "О компании" }]} title="О компании" />
        <AnchorTabs tabs={TABS} className="mt-[24px] md:mt-[28px]" />

        {/* Hero — как первый экран «Сервис центр ДГУ»: серая плашка r11 + фото справа, жёлтая полоса фактов внахлёст */}
        <section id="company" className="relative mt-[16px] scroll-mt-[130px]">
          <div className="grid overflow-hidden rounded-[11px] bg-surface-2 lg:min-h-[475px] lg:grid-cols-[minmax(0,1fr)_572px]">
            <div className="px-[20px] pb-[32px] pt-[28px] md:px-[62px] md:pb-[96px] md:pt-[60px]">
              <h2 className="max-w-[520px] text-[26px] font-bold leading-[34px] md:text-[40px] md:leading-[52px]">Надёжный партнёр энергетической отрасли</h2>
              <Lead className="mt-[16px] max-w-[540px] md:mt-[20px]">ТЭК — один из крупнейших дистрибьюторов электротехники в Таджикистане. Поставляем оборудование, проектируем, монтируем и обслуживаем.</Lead>
              <ul className="mt-[22px] grid grid-cols-1 gap-x-[48px] gap-y-[14px] sm:grid-cols-[auto_auto] sm:justify-start md:mt-[30px] md:gap-y-[20px]">
                {HIGHLIGHTS.map((h) => (
                  <li key={h} className="flex items-center gap-[8px] text-[16px] leading-[20px]">
                    <IconCheckGreen className="size-[15px] shrink-0" />
                    {h}
                  </li>
                ))}
              </ul>
              <div className="mt-[28px] flex flex-wrap gap-[12px] md:mt-[40px]">
                <ButtonLink href="/contacts#feedback" size="lg" className="px-[24px]">
                  Связаться с нами
                </ButtonLink>
                <ButtonLink href="/projects" size="lg" variant="secondary" className="px-[24px]">
                  Наши проекты
                </ButtonLink>
              </div>
            </div>
            <div className="relative h-[220px] sm:h-[300px] lg:h-auto">
              <Image src="/figma/hero-nurek.webp" alt="Нурекская ГЭС" fill priority sizes="(max-width: 1024px) 100vw, 572px" className="object-cover" />
            </div>
          </div>
          <ul className="relative mx-auto mt-[12px] grid max-w-[938px] grid-cols-2 gap-y-[18px] rounded-[11px] bg-brand px-[20px] py-[20px] shadow-[0_2px_8px_2px_rgba(0,0,0,0.13)] md:grid-cols-4 md:px-[48px] md:py-[24px] lg:-mt-[55px]">
            {FACTS.map((f) => (
              <li key={f.label} className="px-[8px] md:px-[12px]">
                <p className="text-[26px] font-bold leading-[30px] tnum md:text-[32px] md:leading-[36px]">{f.value}</p>
                <p className="mt-[4px] text-[14px] leading-[17px] text-black">{f.label}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* О нас: текст из CMS + преимущества */}
        <section className="mt-[56px] grid grid-cols-1 gap-[32px] md:mt-[90px] lg:grid-cols-[minmax(0,1fr)_620px] lg:gap-[60px]">
          <div>
            <SectionTitle>О нас</SectionTitle>
            {page ? <Prose html={page.body_html} className="mt-[18px]" /> : null}
            <p className="mt-[14px] text-[15px] leading-[24px] text-g333 md:text-[16px] md:leading-[26px]">
              Помимо поставок мы оказываем услуги электромонтажа, щитовой сборки, выполняем пусконаладку, ремонт и обслуживание ДГУ.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
            {ADVANTAGES.map((a) => (
              <li key={a.title} className="rounded-[8px] bg-surface px-[24px] pb-[24px] pt-[22px]">
                <Image src={`/corporate/adv/${a.icon}.webp`} alt="" width={48} height={48} className="size-[48px] object-contain" />
                <h3 className="mt-[14px] text-[16px] font-bold leading-[20px]">{a.title}</h3>
                <p className="mt-[6px] text-[14px] leading-[17px] text-sub">{a.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Ключевой ассортимент — плитки категорий как на лендинге (199×122, #F6F7F8 r8) */}
        <section className="mt-[56px] md:mt-[90px]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionTitle>Ключевой ассортимент</SectionTitle>
            <MoreLink href="/catalog">Весь каталог</MoreLink>
          </div>
          <ul className="mt-[24px] grid grid-cols-2 gap-[13px] sm:grid-cols-3 lg:grid-cols-6">
            {RANGE.map((r) => {
              const n = counts.get(r.slug);
              return (
                <li key={r.slug}>
                  <Link href={`/catalog/${r.slug}`} className="group relative flex h-[122px] overflow-hidden rounded-[8px] bg-surface transition-shadow hover:shadow-soft">
                    <span className="relative z-10 px-[16px] pt-[14px] text-[15px] font-bold leading-[20px] text-black">{r.name}</span>
                    {n != null ? <span className="absolute bottom-[14px] left-[16px] z-10 text-[13px] leading-[18px] text-sub">{countLabel(n, ["товар", "товара", "товаров"])}</span> : null}
                    <Image src={`/corporate/range/${r.img}.webp`} alt="" width={84} height={85} className="absolute bottom-[2px] right-[4px] h-[85px] w-[84px] object-contain transition-transform duration-300 group-hover:scale-105" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Бренды-партнёры — белая плашка r11 с тенью и жёлтым ярлыком, как «20+ вендоров» на лендинге */}
        <section id="partners" className="mt-[56px] scroll-mt-[130px] md:mt-[90px]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionTitle>Сотрудничаем с лидерами отрасли</SectionTitle>
            <MoreLink href="/brands">Все бренды</MoreLink>
          </div>
          <Lead className="mt-[12px] max-w-[860px]">
            ТЭК — официальный дистрибьютор крупнейших российских, европейских и китайских производителей электротехники. Под собственными торговыми марками поставляются генераторы HAMMER и бытовые светильники Redium.
          </Lead>
          <div className="relative mt-[36px]">
            <span className="absolute left-1/2 top-0 z-10 inline-flex h-[25px] -translate-x-1/2 -translate-y-1/2 items-center whitespace-nowrap rounded-[7px] bg-brand px-[7px] text-[14px] font-semibold leading-[13px] text-g333">
              20+ вендоров
            </span>
            <ul className="grid grid-cols-2 rounded-[11px] bg-white px-[8px] py-[14px] shadow-[0_1px_7px_3px_rgba(0,0,0,0.07)] sm:grid-cols-4 lg:grid-cols-7 lg:px-[20px]">
              {partners.map((b) => {
                const logo = brandLogo(b);
                return (
                  <li key={b.slug}>
                    <Link href={`/brands/${b.slug}`} title={b.name} className="group flex h-[84px] items-center justify-center px-[14px]">
                      {logo ? (
                        <Image src={logo} alt={b.name} width={130} height={44} className="h-auto max-h-[40px] w-auto max-w-[128px] object-contain transition-transform duration-200 group-hover:scale-105" />
                      ) : (
                        <span className="text-[16px] font-bold">{b.name}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Партнерские сертификаты */}
        <section id="certificates" className="mt-[56px] scroll-mt-[130px] md:mt-[90px]">
          <SectionTitle>Партнерские сертификаты</SectionTitle>
          <Lead className="mt-[12px] max-w-[860px]">Сертификаты официального дистрибьютора подтверждают поставки оригинальной продукции напрямую от производителей и гарантийные обязательства.</Lead>
          <ul className="mt-[24px] grid grid-cols-2 gap-[13px] md:mt-[28px] lg:grid-cols-4 lg:gap-[20px]">
            {CERTIFICATES.map((c) => (
              <li key={c.n}>
                <a href={asset(`/corporate/certs/${c.n}.webp`)} target="_blank" rel="noopener" className="group flex h-full flex-col overflow-hidden rounded-[11px] bg-surface-2 transition-shadow hover:shadow-pop">
                  <span className="relative flex h-[190px] items-center justify-center p-[18px] md:h-[280px] md:p-[28px]">
                    <Image src={`/corporate/certs/${c.n}-preview.webp`} alt={`Сертификат дистрибьютора ${c.brand}`} width={368} height={520} className="h-auto max-h-full w-auto max-w-full shadow-card transition-transform duration-300 group-hover:scale-[1.03]" />
                  </span>
                  <span className="mt-auto flex flex-col border-t border-line-3 px-[16px] py-[14px] md:px-[20px] md:py-[16px]">
                    <span className="text-[15px] font-bold leading-[20px] text-black md:text-[16px]">{c.brand}</span>
                    <span className="mt-[4px] text-[13px] leading-[18px] text-muted">Сертификат · JPG, {c.size}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Нам доверяют — серая полоса во всю ширину, как «Реализованные проекты» на лендинге */}
      <section id="clients" className="mt-[56px] scroll-mt-[114px] bg-surface py-[48px] md:mt-[90px] md:py-[80px]">
        <div className="container-page">
          <SectionTitle>Нам доверяют</SectionTitle>
          <Lead className="mt-[12px] max-w-[860px]">Работаем с крупнейшими электромонтажными компаниями, энергетиками и международными EPC-подрядчиками.</Lead>
          <ul className="mt-[24px] grid grid-cols-2 gap-[13px] sm:grid-cols-3 md:mt-[32px] lg:grid-cols-6">
            {CLIENTS.map((c) => (
              <li key={c.file} className="group flex h-[96px] items-center justify-center rounded-[10px] bg-white px-[20px]" title={c.name}>
                <Image src={`/corporate/clients/${c.file}.webp`} alt={c.name} width={160} height={70} className="h-auto max-h-[56px] w-auto max-w-[140px] object-contain opacity-80 grayscale transition duration-200 group-hover:opacity-100 group-hover:grayscale-0" />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="container-page">
        <CtaBand className="mt-[56px] md:mt-[90px]" />
      </div>
    </div>
  );
}
