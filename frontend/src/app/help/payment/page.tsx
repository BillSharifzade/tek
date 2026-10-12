import type { Metadata } from "next";
import { siteFlags } from "@/lib/server";
import { SectionTitle, Lead } from "@/components/content/PageHead";
import { Prose } from "@/components/content/Prose";
import { IconCube, IconUserCircle } from "@/components/content/icons";

export const metadata: Metadata = {
  title: "Оплата",
  description: "Оплата в ТЭК: наличными или картой при получении, по счёту для юридических лиц.",
};

/**
 * Способы оплаты — по факту подключения: онлайн-оплата Алиф / ДС появляется в списке, когда её включат
 * (`GET /content/site`, `online_payment`); до этого страница её не обещает.
 */
function methodsHtml(online: boolean): string {
  const methods = [
    ...(online ? ["<strong>Алиф Банк</strong> — онлайн-оплата картой", "<strong>Душанбе Сити Банк</strong> — онлайн-оплата картой"] : []),
    "<strong>Наличными</strong> — при получении",
    "<strong>По счёту</strong> — для юридических лиц",
  ];
  return `<ul>${methods.map((m) => `<li>${m}</li>`).join("")}</ul>`;
}

export default async function PaymentPage() {
  const { online_payment: online } = await siteFlags();
  return (
    <section className="mt-[40px] md:mt-[56px]">
      <SectionTitle>Оплата</SectionTitle>
      <Lead className="mt-[12px]">Оплата производится в национальной валюте — сомони (TJS).</Lead>
      <div className="mt-[24px] grid grid-cols-1 gap-[13px] md:grid-cols-2 lg:grid-cols-3 lg:gap-[20px]">
        <div className="flex gap-[22px] rounded-[8px] bg-surface-2 px-[24px] py-[24px] md:px-[34px] md:py-[28px]">
          <IconUserCircle className="size-[48px] shrink-0" />
          <div>
            <h3 className="text-[16px] font-bold leading-[20px]">Для физических лиц</h3>
            <p className="mt-[8px] text-[14px] leading-[20px] text-sub">Наличными или картой курьеру при доставке или при получении в наших магазинах.{online ? " Онлайн-оплата картой при оформлении заказа." : ""}</p>
          </div>
        </div>
        <div className="flex gap-[22px] rounded-[8px] bg-surface-2 px-[24px] py-[24px] md:px-[34px] md:py-[28px]">
          <IconCube className="size-[48px] shrink-0" />
          <div>
            <h3 className="text-[16px] font-bold leading-[20px]">Для юридических лиц</h3>
            <p className="mt-[8px] text-[14px] leading-[20px] text-sub">Банковским переводом по счёту. Счёт появится в разделе «Документы» личного кабинета, срок оплаты — 3 рабочих дня.</p>
          </div>
        </div>
        <div className="rounded-[8px] bg-surface-2 px-[24px] py-[24px] md:col-span-2 md:px-[34px] md:py-[28px] lg:col-span-1">
          <h3 className="text-[16px] font-bold leading-[20px]">Способы оплаты</h3>
          <Prose html={methodsHtml(online)} className="mt-[10px] text-[14px] leading-[20px] md:text-[14px] md:leading-[20px] [&_ul]:gap-[4px] [&_ul>li]:before:top-[8px]" />
        </div>
      </div>
    </section>
  );
}
