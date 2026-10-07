export const SITE = {
  name: "ТЭК",
  /** публичный адрес сайта: canonical/OG-ссылки, sitemap, robots (встраивается при сборке) */
  url: (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3010").replace(/\/+$/, ""),
  company: "ООО «Точикэлектрокомплект»",
  phone: "+992 446 20 60 60",
  phoneHref: "tel:+992446206060",
  /** общие вопросы */
  email: "info@tec.tj",
  /** отдел продаж */
  salesEmail: "sales@tec.tj",
  /** главный офис */
  address1: "г. Душанбе, ул. Бохтар 37/1, офис 704",
  /** координаты главного офиса (lat, lon) */
  officeCoords: [38.577428, 68.789822] as [number, number],
  /** магазин */
  address2: "г. Душанбе, пр-кт Х. Шерози 28/30, рынок Кушониён (магазин #327)",
  legalAddress: "г. Душанбе, ул. И. Сомони 68/13",
  /** режим работы главного офиса */
  hours: "Пн – Пт: 9:00–17:00",
  hoursFull: "Пн – Пт: 9:00–17:00, Сб – Вс — выходной",
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
  /** пункт с выпадающим списком сам ведёт на `href` (выпадающий список — по наведению) */
  clickable?: boolean;
}

/** Верхнее меню шапки (О компании ▾ · Услуги ▾ · Проекты · Поддержка · Покупателям ▾); доработки R2: «Услуги» — ссылка на все услуги */
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
      { href: "/vacancies", label: "Вакансии" },
      { href: "/contacts", label: "Контакты" },
    ],
  },
  {
    href: "/services",
    label: "Услуги",
    w: 57.1,
    clickable: true,
    children: [
      { href: "/services/obsluzhivanie-dgu-ibp", label: "Сервис центр ДГУ" },
      { href: "/services/solnechnye-elektrostantsii", label: "Солнечные электростанции под ключ" },
      { href: "/support", label: "Для проектировщиков" },
    ],
  },
  { href: "/projects", label: "Проекты", w: 60 },
  { href: "/support", label: "Поддержка", w: 76 },
  {
    href: "/help",
    label: "Покупателям",
    w: 100.1,
    children: [
      { href: "/help", label: "Как купить?" },
      { href: "/help/delivery", label: "Доставка" },
      { href: "/help/warranty", label: "Гарантия" },
    ],
  },
];

