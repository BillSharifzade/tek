import type { Metadata } from "next";
import { publicGet, safe } from "@/lib/server";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Prose } from "@/components/content/Prose";
import { Faq } from "@/components/content/Faq";
import type { CmsPage } from "@/components/content/types";

export const metadata: Metadata = { title: "Помощь" };

const NAV = [
  { href: "#delivery", label: "Доставка" },
  { href: "#payment", label: "Оплата" },
  { href: "#faq", label: "Вопросы и ответы" },
];

export default async function HelpPage() {
  const [help, delivery, payment] = await Promise.all([
    safe(publicGet<CmsPage | null>("/content/pages/help", undefined, 300), null),
    safe(publicGet<CmsPage | null>("/content/pages/delivery", undefined, 300), null),
    safe(publicGet<CmsPage | null>("/content/pages/payment", undefined, 300), null),
  ]);

  return (
    <div className="container-page pb-14">
      <Breadcrumbs items={[{ label: "Помощь" }]} />
      <h1>Помощь</h1>
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Разделы помощи" className="self-start lg:sticky lg:top-24">
          <ul className="flex gap-2 overflow-x-auto scrollbar-none lg:flex-col lg:gap-0 lg:rounded-[8px] lg:border lg:border-line lg:bg-white lg:p-2">
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href} className="block whitespace-nowrap rounded-[6px] px-4 py-2.5 text-base font-medium transition-colors hover:bg-surface hover:text-brand-hover">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-12">
          {help ? <Prose html={help.body_html} className="max-w-3xl" /> : null}

          <section id="delivery" className="scroll-mt-24">
            <h2 className="mb-4">Доставка</h2>
            <div className="rounded-[8px] border border-line bg-white p-6">
              {delivery ? <Prose html={delivery.body_html} /> : <p className="text-sub">Бережно доставляем товары по Таджикистану за 48 часов.</p>}
            </div>
          </section>

          <section id="payment" className="scroll-mt-24">
            <h2 className="mb-4">Оплата</h2>
            <div className="rounded-[8px] border border-line bg-white p-6">
              {payment ? <Prose html={payment.body_html} /> : <p className="text-sub">Онлайн-оплата (Алиф Банк, Душанбе Сити Банк), наличными при получении, по счёту для юридических лиц.</p>}
            </div>
          </section>

          <section id="faq" className="scroll-mt-24">
            <h2 className="mb-4">Вопросы и ответы</h2>
            <Faq />
          </section>
        </div>
      </div>
    </div>
  );
}
