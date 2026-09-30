import Link from "next/link";
import Image from "next/image";
import type { CategoryNode } from "@/lib/types";
import { SITE } from "@/lib/site";
import { IconPin } from "@/components/icons/figma";
import { FacebookIcon, InstagramIcon, YoutubeIcon } from "@/components/ui/SocialIcons";
import { SOCIAL_LINKS } from "@/components/content/company";

/**
 * Подвал в языке шапки (макета подвала нет): белый фон, линии #EBEDF8, контент 1260px,
 * логотип 121.8×44, ссылки Roboto 14 #666 → #000, заголовки колонок 16 Bold, жёлтая кнопка r5 как «Каталог».
 */

const COMPANY = [
  { href: "/about", label: "О компании" },
  { href: "/news", label: "Новости" },
  { href: "/projects", label: "Проекты" },
  { href: "/brands", label: "Бренды" },
  { href: "/about#certificates", label: "Сертификаты" },
  { href: "/about#vacancies", label: "Вакансии" },
  { href: "/contacts", label: "Контакты" },
];

const CUSTOMERS = [
  { href: "/help#how-to-buy", label: "Как купить" },
  { href: "/help#delivery", label: "Доставка" },
  { href: "/help#payment", label: "Оплата" },
  { href: "/help#warranty", label: "Гарантия" },
  { href: "/help#faq", label: "Вопросы и ответы" },
  { href: "/support", label: "Поддержка" },
  { href: "/configurators", label: "Конфигураторы" },
];

const SERVICES = [
  { href: "/services/obsluzhivanie-dgu-ibp", label: "Сервис центр ДГУ" },
  { href: "/services/solnechnye-elektrostantsii", label: "Солнечные электростанции" },
  { href: "/services/podderzhka-v-proektirovanii", label: "Поддержка в проектировании" },
  { href: "/services", label: "Все услуги" },
];

const socials = [
  { href: SOCIAL_LINKS.facebook, label: "Facebook", Icon: FacebookIcon },
  { href: SOCIAL_LINKS.instagram, label: "Instagram", Icon: InstagramIcon },
  { href: SOCIAL_LINKS.youtube, label: "YouTube", Icon: YoutubeIcon },
];

function Col({ title, links, className }: { title: string; links: { href: string; label: string }[]; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[16px] font-bold leading-[20px] text-black">{title}</p>
      <ul className="mt-[16px] flex flex-col gap-[10px] text-[14px] leading-[18px] text-sub">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="link-hover">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer({ categories }: { categories: CategoryNode[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line-2 bg-white">
      {/* верхняя полоса: логотип + телефон + кнопка, как вторая строка шапки */}
      <div className="container-page flex flex-col gap-[20px] py-[28px] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-[20px]">
          <Link href="/" aria-label="ТЭК — на главную" className="shrink-0">
            <Image src="/figma/logo.png" alt="ТЭК — Точикэлектрокомплект" width={122} height={44} className="h-[44px] w-auto" />
          </Link>
          <p className="hidden max-w-[260px] text-[13px] leading-[17px] text-sub sm:block">Дистрибьютор электротехники в Таджикистане с 2009 года</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-[28px] gap-y-[14px]">
          <div className="flex flex-col">
            <a href={SITE.phoneHref} className="link-hover text-[20px] font-bold leading-[24px] text-black tnum">
              {SITE.phone}
            </a>
            <span className="mt-[2px] text-[13px] leading-[17px] text-muted">{SITE.hours}</span>
          </div>
          <Link href="/contacts#feedback" className="inline-flex h-[44px] items-center rounded-[5px] bg-brand px-[20px] text-[14px] font-medium text-black transition-colors hover:bg-brand-hover">
            Задать вопрос
          </Link>
        </div>
      </div>

      <div className="border-t border-line-2">
        <div className="container-page grid grid-cols-2 gap-x-[24px] gap-y-[36px] py-[36px] md:grid-cols-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.15fr)] lg:gap-x-[40px] lg:py-[44px]">
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <p className="text-[16px] font-bold leading-[20px] text-black">
              <Link href="/catalog" className="link-hover">
                Каталог
              </Link>
            </p>
            <ul className="mt-[16px] grid grid-cols-1 gap-x-[24px] gap-y-[10px] text-[14px] leading-[18px] text-sub sm:grid-cols-2 lg:grid-cols-1">
              {categories.slice(0, 12).map((c) => (
                <li key={c.slug}>
                  <Link href={`/catalog/${c.slug}`} className="link-hover">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <Col title="Компания" links={COMPANY} />
          <Col title="Покупателям" links={CUSTOMERS} />
          <div className="col-span-2 md:col-span-2 lg:col-span-1">
            <Col title="Услуги" links={SERVICES} />
            <p className="mt-[28px] text-[16px] font-bold leading-[20px] text-black">Контакты</p>
            <ul className="mt-[16px] flex flex-col gap-[10px] text-[14px] leading-[18px] text-sub">
              <li className="flex items-start gap-[6px]">
                <IconPin className="mt-[1px] shrink-0" />
                <span>{SITE.address1}</span>
              </li>
              <li className="flex items-start gap-[6px]">
                <IconPin className="mt-[1px] shrink-0" />
                <span>{SITE.address2}</span>
              </li>
              <li className="pl-[21px]">
                <a href={`mailto:${SITE.email}`} className="text-g333 underline underline-offset-2 transition-colors hover:text-black">
                  {SITE.email}
                </a>
                <span className="text-muted"> · </span>
                <a href={SITE.phone2Href} className="link-hover tnum">
                  {SITE.phone2}
                </a>
              </li>
            </ul>
            <div className="mt-[18px] flex items-center gap-[8px]">
              {socials.map(({ href, label, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex size-[36px] items-center justify-center rounded-full bg-btn text-g333 transition-colors hover:bg-btn-hover hover:text-black">
                  <Icon className="size-[16px]" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-line-2">
        <div className="container-page flex flex-col gap-[10px] py-[18px] text-[13px] leading-[17px] text-muted md:flex-row md:items-center md:justify-between">
          <span>
            © {year} {SITE.company}. Все права защищены.
          </span>
          <div className="flex flex-wrap items-center gap-x-[20px] gap-y-2">
            <span>Оплата: Алиф Банк · Душанбе Сити · наличные · по счёту</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
