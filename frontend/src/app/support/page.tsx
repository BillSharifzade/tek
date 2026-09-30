import Link from "next/link";
import type { Metadata } from "next";
import { publicGet, safe } from "@/lib/server";
import { SITE } from "@/lib/site";
import { ButtonLink } from "@/components/ui/Button";
import { PageHead, SectionTitle, Lead } from "@/components/content/PageHead";
import { Prose } from "@/components/content/Prose";
import { ConfiguratorCard } from "@/components/content/ConfiguratorCard";
import { CatalogLibrary } from "@/components/content/CatalogLibrary";
import { CtaBand } from "@/components/content/CtaBand";
import { IconCheckBold, IconCube, IconUserCircle } from "@/components/content/icons";
import { CATALOGS } from "@/components/content/catalogs";
import type { CmsPage, ConfiguratorItem } from "@/components/content/types";

export const metadata: Metadata = {
  title: "Поддержка",
  description: "Онлайн-конфигураторы, каталоги и брошюры производителей, сертификаты и помощь инженеров ТЭК в проектировании.",
};

function IconDoc({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 57 57" fill="none" className={className} aria-hidden>
      <path d="M14 5.5h20.5L45 16v33.5a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2v-42a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="4.2" strokeLinejoin="round" />
      <path d="M33.5 6v11h11M20 29h17M20 38h17" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function SupportPage() {
  const [page, configurators] = await Promise.all([
    safe(publicGet<CmsPage>("/content/pages/support", undefined, 300), null),
    safe(publicGet<ConfiguratorItem[]>("/content/configurators", undefined, 300), [] as ConfiguratorItem[]),
  ]);

  // плитки разделов — как сервисные плитки лендинга (385×122, #F7F8F9 r8, иконка 57, 16 Bold + 14/17 #666)
  const tiles = [
    { href: "#configurators", title: "Конфигураторы", text: "Онлайн-расчёт кабеленесущих систем и комплектации", Icon: IconCube },
    { href: "#catalogs", title: "Каталоги и брошюры", text: `${CATALOGS.length} PDF-каталогов и типовых альбомов производителей`, Icon: IconDoc },
    { href: "/services/podderzhka-v-proektirovanii", title: "Помощь в проектировании", text: "Подбор оборудования, спецификации и техническая защита", Icon: IconUserCircle },
    { href: "/about#certificates", title: "Сертификаты", text: "Сертификаты дистрибьютора и документация на товары", Icon: IconCheckBold },
  ];

  return (
    <div className="container-page pb-[64px] md:pb-[100px]">
      <PageHead crumbs={[{ label: "Поддержка" }]} title={page?.title ?? "Поддержка"} />

      <section className="mt-[20px] grid grid-cols-1 gap-[28px] md:mt-[24px] lg:grid-cols-[minmax(0,1fr)_417px] lg:gap-[60px]">
        {page ? <Prose html={page.body_html} /> : <div />}
        <div className="self-start rounded-[10px] bg-white px-[24px] py-[26px] shadow-card md:px-[34px]">
          <h2 className="text-[16px] font-semibold leading-[20px] text-g333">Инженер на связи</h2>
          <a href={SITE.phoneHref} className="link-hover mt-[12px] block text-[22px] font-bold leading-[28px] tnum">
            {SITE.phone}
          </a>
          <p className="mt-[4px] text-[13px] leading-[20px] text-sub">{SITE.hours}</p>
          <ButtonLink href="/contacts#feedback" size="lg" full className="mt-[20px]">
            Задать вопрос инженеру
          </ButtonLink>
        </div>
      </section>

      <ul className="mt-[40px] grid grid-cols-1 gap-[13px] sm:grid-cols-2 md:mt-[56px] lg:grid-cols-4 lg:gap-[16px]">
        {tiles.map(({ href, title, text, Icon }) => (
          <li key={title}>
            <Link href={href} className="group flex h-full min-h-[122px] items-center gap-[20px] rounded-[8px] bg-surface-2 px-[24px] py-[20px] transition-shadow hover:shadow-soft">
              <Icon className="size-[48px] shrink-0 text-black" />
              <span>
                <span className="block text-[16px] font-bold leading-[20px] text-black">{title}</span>
                <span className="mt-[5px] block text-[14px] leading-[17px] text-sub">{text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {configurators.length > 0 ? (
        <section id="configurators" className="mt-[56px] scroll-mt-[130px] md:mt-[90px]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionTitle>Конфигураторы</SectionTitle>
            <Link href="/configurators" className="text-[14px] leading-[20px] text-g333 underline underline-offset-[3px] transition-colors hover:text-black">
              Все конфигураторы
            </Link>
          </div>
          <ul className="mt-[24px] grid grid-cols-1 gap-[20px] lg:grid-cols-2">
            {configurators.map((c) => (
              <li key={c.slug}>
                <ConfiguratorCard item={c} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section id="catalogs" className="mt-[56px] scroll-mt-[130px] md:mt-[90px]">
        <SectionTitle>Каталоги и брошюры</SectionTitle>
        <Lead className="mt-[12px] max-w-[860px]">Актуальные каталоги продукции и альбомы типовых решений производителей — для подбора оборудования и проектирования.</Lead>
        <div className="mt-[24px]">
          <CatalogLibrary />
        </div>
      </section>

      <CtaBand className="mt-[56px] md:mt-[90px]" title="Нужна помощь с подбором?" text="Инженеры ТЭК помогут подобрать оборудование, рассчитать кабеленесущие системы и подготовить спецификацию." />
    </div>
  );
}
