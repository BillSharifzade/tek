import { PageHead } from "@/components/content/PageHead";
import { RouteTabs, type RouteTab } from "@/components/content/RouteTabs";

/** Разделы «Покупателям»: кнопки-переключатели вместо прокрутки (доработки R2) — каждый раздел своей страницей. */
const HELP_TABS: RouteTab[] = [
  { href: "/help", label: "Как купить?", anchor: "how-to-buy" },
  { href: "/help/delivery", label: "Доставка", anchor: "delivery" },
  { href: "/help/payment", label: "Оплата", anchor: "payment" },
  { href: "/help/warranty", label: "Гарантия", anchor: "warranty" },
  { href: "/help/faq", label: "Вопросы и ответы", anchor: "faq" },
];

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page pb-[64px] md:pb-[100px]">
      <PageHead crumbs={[{ label: "Покупателям" }]} title="Покупателям" />
      <RouteTabs tabs={HELP_TABS} label="Разделы для покупателей" className="mt-[24px] md:mt-[28px]" />
      {children}
    </div>
  );
}
