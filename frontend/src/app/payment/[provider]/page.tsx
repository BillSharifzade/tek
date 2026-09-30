import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconAlif, IconDcBank } from "@/components/cart/icons";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Онлайн-оплата", robots: { index: false } };

const PROVIDERS: Record<string, { name: string; icon: React.ReactNode }> = {
  alif: { name: "Алиф Банк", icon: <IconAlif /> },
  dc: { name: "Душанбе Сити Банк", icon: <IconDcBank /> },
};

/**
 * Точка перехода на онлайн-оплату (сюда ведёт redirect из POST /checkout для alif/dc).
 * Платёжные страницы банков подключаются вместе с merchant-аккаунтами Алиф/ДС — до этого
 * заказ остаётся оформленным с ожиданием оплаты, а менеджер присылает ссылку на оплату.
 */
export default async function PaymentPage({ params, searchParams }: { params: Promise<{ provider: string }>; searchParams: Promise<{ order?: string }> }) {
  const { provider } = await params;
  const { order } = await searchParams;
  const p = PROVIDERS[provider];
  if (!p) notFound();

  return (
    <div className="bg-surface">
      <div className="mx-auto w-full max-w-[1314px] px-4 pb-[100px] pt-[48px]">
        <div className="max-w-[740px] rounded-[10px] border border-line-3 bg-white px-[16px] py-[32px] sm:px-[38px]">
          <div className="flex items-center gap-[14px]">
            <span className="flex h-[54px] items-center rounded-[6px] bg-btn px-[16px]">{p.icon}</span>
            <h1 className="text-[26px] font-bold leading-[30px] text-black">Оплата через {p.name}</h1>
          </div>
          <p className="mt-[20px] rounded-[7px] bg-brand-light px-[16px] py-[12px] text-[14px] leading-[20px] text-black">
            {order ? <>Заказ №{order} оформлен и зарезервирован. </> : null}
            Онлайн-оплата через {p.name} подключается — менеджер отправит вам ссылку на оплату в течение рабочего дня. Вы также можете оплатить заказ при получении.
          </p>
          <p className="mt-[16px] text-[14px] leading-[20px] text-sub">
            Вопросы по оплате: <a href={SITE.phoneHref} className="text-black link-hover">{SITE.phone}</a>
          </p>
          <div className="mt-[24px] flex flex-wrap gap-[9px]">
            {order ? (
              <Link
                href={`/checkout/success/${encodeURIComponent(order)}`}
                className="flex h-[44px] items-center rounded-[6px] bg-brand px-[32px] text-[15px] font-medium leading-[24px] text-black transition-colors hover:bg-brand-hover"
              >
                К заказу
              </Link>
            ) : null}
            <Link href="/catalog" className="flex h-[44px] items-center rounded-[6px] bg-btn px-[32px] text-[15px] font-medium leading-[24px] text-black transition-colors hover:bg-btn-hover">
              Продолжить покупки
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
