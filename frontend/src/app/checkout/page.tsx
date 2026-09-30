import type { Metadata } from "next";
import { CheckoutView } from "@/components/checkout/CheckoutView";

export const metadata: Metadata = { title: "Оформление заказа" };

/** Figma «Оформление заказа» 10461:576: фон #F6F7F8, контент с x=115 (1282px), заголовок 26/12 Bold @162. */
export default function CheckoutPage() {
  return (
    <div className="bg-surface">
      <div className="mx-auto w-full max-w-[1314px] px-4 pb-[100px] pt-[48px]">
        <h1 className="text-[26px] font-bold leading-[12px] text-black">Оформление заказа</h1>
        <CheckoutView />
      </div>
    </div>
  );
}
