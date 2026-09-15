import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { OrderSummaryCard } from "@/components/account/OrderSummaryCard";

export const metadata: Metadata = { title: "Заказ оформлен" };

export default async function CheckoutSuccessPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return (
    <div className="container-page">
      <div className="mx-auto mt-10 max-w-[720px]">
        <div className="flex flex-col items-center rounded-[8px] border border-line bg-white p-8 text-center">
          <CheckCircle2 className="size-14 text-success" strokeWidth={1.5} />
          <h1 className="mt-4">Заказ №{number} оформлен</h1>
          <p className="mt-2 max-w-md text-sub">
            Спасибо! Заказ передан менеджеру и зарезервирован на складе. Подтверждение отправлено на ваш e-mail, менеджер свяжется с вами в ближайшее время.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href={`/account/orders/${number}`}>Перейти к заказу</ButtonLink>
            <ButtonLink href="/catalog" variant="secondary">
              Продолжить покупки
            </ButtonLink>
          </div>
        </div>
        <div className="mt-6">
          <OrderSummaryCard number={number} />
        </div>
      </div>
    </div>
  );
}
