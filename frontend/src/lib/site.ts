export const SITE = {
  name: "ТЭК",
  /** публичный адрес сайта: canonical/OG-ссылки, sitemap, robots (встраивается при сборке) */
  url: (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3010").replace(/\/+$/, ""),
  company: "ООО «Точикэлектрокомплект»",
  phoneShort: "446 20 60 60",
  phone: "+992 (44) 620 60 60",
  phoneHref: "tel:+992446206060",
  phone2: "+992 55 000 66 13",
  phone2Href: "tel:+992550006613",
  email: "info@tec.tj",
  address1: "г. Душанбе, ул. Академика Акобира Адхамова 43",
  address2: "г. Душанбе, пр-кт Х. Шерози 28/30, рынок Кушониён (магазин #327)",
  hours: "Пн–Сб: 8:00–18:00",
  socials: {
    facebook: "https://www.facebook.com/TojikElectroComplect",
    instagram: "https://www.instagram.com/tojikelectrocomplect/",
    youtube: "https://www.youtube.com/@Tojikelectrocomplect",
  },
};

export interface NavItem {
  href: string;
  label: string;
  /** ширина пункта в макете (текст + каретка), px — фиксирует позиции как в Figma */
  w: number;
  children?: { href: string; label: string }[];
}

/** Верхнее меню шапки — как в макете Figma (О компании ▾ · Услуги ▾ · Проекты · Конфигураторы · Покупателям ▾) */
export const TOP_NAV: NavItem[] = [
  {
    href: "/about",
    label: "О компании",
    w: 91.1,
    children: [
      { href: "/about", label: "О компании" },
      { href: "/news", label: "Новости" },
      { href: "/projects", label: "Проекты" },
      { href: "/about#certificates", label: "Партнерские сертификаты" },
      { href: "/about#vacancies", label: "Вакансии" },
      { href: "/contacts", label: "Контакты" },
    ],
  },
  {
    href: "/services",
    label: "Услуги",
    w: 57.1,
    children: [
      { href: "/services/obsluzhivanie-dgu-ibp", label: "Сервис центр ДГУ" },
      { href: "/services/solnechnye-elektrostantsii", label: "Солнечные электростанции под ключ" },
      { href: "/services/podderzhka-v-proektirovanii", label: "Поддержка в проектировании" },
    ],
  },
  { href: "/projects", label: "Проекты", w: 60 },
  { href: "/configurators", label: "Конфигураторы", w: 105 },
  {
    href: "/help",
    label: "Покупателям",
    w: 100.1,
    children: [
      { href: "/help#how-to-buy", label: "Как купить" },
      { href: "/help#delivery", label: "Доставка" },
      { href: "/help#warranty", label: "Гарантия" },
    ],
  },
];

