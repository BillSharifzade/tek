export const SITE = {
  name: "ТЭК",
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
    facebook: "https://www.facebook.com/tectj",
    instagram: "https://www.instagram.com/tectj",
    youtube: "https://www.youtube.com/@tectj",
  },
};

export const TOP_NAV = [
  { href: "/about", label: "О компании" },
  { href: "/services", label: "Услуги" },
  { href: "/projects", label: "Проекты" },
  { href: "/support", label: "Поддержка" },
  { href: "/contacts", label: "Контакты" },
  { href: "/help", label: "Помощь" },
];

export const FOOTER_COMPANY = [
  { href: "/about", label: "О компании" },
  { href: "/services", label: "Услуги" },
  { href: "/projects", label: "Проекты" },
  { href: "/news", label: "Новости" },
  { href: "/contacts", label: "Контакты" },
];

export const FOOTER_CUSTOMERS = [
  { href: "/help", label: "Помощь" },
  { href: "/help#delivery", label: "Доставка" },
  { href: "/help#payment", label: "Оплата" },
  { href: "/support", label: "Поддержка" },
  { href: "/configurators", label: "Конфигураторы" },
  { href: "/brands", label: "Бренды" },
];

export const ACCOUNT_NAV = [
  { href: "/account", label: "Основная информация", exact: true },
  { href: "/account/personal", label: "Личные данные" },
  { href: "/account/company", label: "Данные компании" },
  { href: "/account/orders", label: "Заказы" },
  { href: "/account/balance", label: "Баланс" },
  { href: "/account/bonus", label: "Бонусная карта" },
  { href: "/account/reviews", label: "Отзывы и вопросы" },
  { href: "/account/documents", label: "Документы" },
  { href: "/account/favorites", label: "Избранное" },
  { href: "/account/personal#notifications", label: "Настройка уведомлений" },
];

export const SORT_OPTIONS = [
  { value: "popular", label: "Популярные" },
  { value: "new", label: "Новинки" },
  { value: "price_asc", label: "Сначала дешевле" },
  { value: "price_desc", label: "Сначала дороже" },
];

export const ORDER_STATUS_COLORS: Record<string, string> = {
  new: "bg-info/10 text-info",
  confirmed: "bg-brand-light text-ink",
  processing: "bg-brand-light text-ink",
  shipped: "bg-info/10 text-info",
  delivered: "bg-success/10 text-success",
  cancelled: "bg-sale/10 text-sale",
};
