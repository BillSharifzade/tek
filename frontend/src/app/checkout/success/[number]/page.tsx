import type { Metadata } from "next";
import Link from "next/link";
import { OrderSummaryCard } from "@/components/account/OrderSummaryCard";

export const metadata: Metadata = { title: "Заказ оформлен" };

/** Экрана в макете нет — собран в языке чекаута 10461:576: фон #F6F7F8, белая карточка r10 с рамкой #D9DDE4. */
export default async function CheckoutSuccessPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return (
    <div className="bg-surface">
      <div className="mx-auto w-full max-w-[1314px] px-4 pb-[100px] pt-[48px]">
        <div className="max-w-[740px]">
          <div className="rounded-[10px] border border-line-3 bg-white px-[16px] py-[32px] sm:px-[38px]">
            <div className="flex items-center gap-[12px]">
              <svg width={28} height={28} viewBox="0 0 14 14" aria-hidden>
                <circle cx="7" cy="7" r="7" fill="#00BA00" />
                <path d="M4.2 7.1l1.9 1.9 3.8-3.9" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h1 className="text-[26px] font-bold leading-[30px] text-black">Заказ №{number} оформлен</h1>
            </div>
            <p className="mt-[16px] max-w-[560px] text-[14px] leading-[20px] text-sub">
              Спасибо! Заказ передан менеджеру и зарезервирован на складе. Подтверждение отправлено на ваш e-mail, менеджер свяжется с вами в ближайшее время.
            </p>
            <div className="mt-[24px] flex flex-wrap gap-[9px]">
              <Link
                href={`/account/orders/${number}`}
                className="flex h-[44px] items-center rounded-[4px] bg-brand px-[32px] text-[15px] font-medium leading-[24px] text-black transition-colors hover:bg-brand-hover"
              >
                Перейти к заказу
              </Link>
              <Link href="/catalog" className="flex h-[44px] items-center rounded-[4px] bg-btn px-[32px] text-[15px] font-medium leading-[24px] text-black transition-colors hover:bg-btn-hover">
                Продолжить покупки
              </Link>
            </div>
          </div>
          <div className="mt-[24px]">
            <OrderSummaryCard number={number} />
          </div>
        </div>
      </div>
    </div>
  );
}
