import type { Metadata } from "next";
import { publicGet, safe } from "@/lib/server";
import { SectionTitle } from "@/components/content/PageHead";
import { Prose } from "@/components/content/Prose";
import { InfoPanel, Note, PriceCard } from "@/components/content/Blocks";
import { IconTruck } from "@/components/content/icons";
import type { CmsPage } from "@/components/content/types";

export const metadata: Metadata = {
  title: "Доставка",
  description: "Доставка ТЭК: время и правила доставки, стоимость по Душанбе и Худжанду, доставка манипулятором.",
};

/** Тексты — из «Покупателям - доставка.docx». */
const DELIVERY_TIME =
  "С понедельника по субботу в течение 24 часов после согласования заявки с продавцом. Заказы, согласованные после 14:00, могут быть доставлены на следующий день.";

const DELIVERY_RULES = [
  "Доставка осуществляется собственной службой доставки по адресу, указанному в заказе.",
  "Доставка осуществляется после того, как вы подтвердите готовность получить товар.",
  "Перед отправкой водитель свяжется с вами по указанному номеру.",
  "Тяжёлое и габаритное оборудование (генераторы, трансформаторы, большие кабельные барабаны и т.д.) доставляется манипулятором и разгружается на прилегающую к манипулятору территорию без заноса в помещение.",
  "Если нужен кран, услуга согласовывается с менеджером и оплачивается заранее.",
  "Просим заранее обеспечить место и доступ водителю для проезда транспорта.",
  "Дату доставки можно перенести или скорректировать заказ, позвонив персональному менеджеру.",
];

export default async function DeliveryPage() {
  const delivery = await safe(publicGet<CmsPage | null>("/content/pages/delivery", undefined, 300), null);
  return (
    <section className="mt-[40px] md:mt-[56px]">
      <SectionTitle>Доставка</SectionTitle>
      <div className="mt-[20px] grid grid-cols-1 gap-[32px] md:mt-[24px] lg:grid-cols-[minmax(0,1fr)_417px] lg:gap-[60px]">
        <div>
          {delivery ? <Prose html={delivery.body_html} className="[&_em]:hidden" /> : null}
          <h3 className="mt-[28px] text-[18px] font-bold leading-[24px]">Время доставки</h3>
          <p className="mt-[10px] text-[15px] leading-[24px] text-g333 md:text-[16px] md:leading-[26px]">{DELIVERY_TIME}</p>
          <h3 className="mt-[28px] text-[18px] font-bold leading-[24px]">Правила доставки</h3>
          <ul className="mt-[12px] flex flex-col gap-[8px] text-[15px] leading-[24px] text-g333 md:text-[16px] md:leading-[26px]">
            {DELIVERY_RULES.map((r) => (
              <li key={r} className="relative pl-[18px] before:absolute before:left-[4px] before:top-[11px] before:size-[5px] before:rounded-full before:bg-[#B3BAC7] before:content-['']">
                {r}
              </li>
            ))}
          </ul>
          <Note title="Обратите внимание" className="mt-[28px]">
            Подъём на этаж и разгрузка товара не входят в услугу доставки (кроме доставки манипулятором).
          </Note>
        </div>
        <PriceCard
          title="Стоимость доставки"
          className="self-start"
          rows={[
            ["Душанбе, заказ от 1000 с.", "Бесплатно"],
            ["Душанбе, заказ до 1000 с.", "30 с."],
            ["Самовывоз со склада и из магазина", "Бесплатно"],
            ["За пределы Душанбе и Худжанда", "По договорённости"],
          ]}
        >
          <InfoPanel className="mt-[24px]" icon={<IconTruck className="size-[21px] shrink-0" />} title="Генераторы и трансформаторы">
            Доставка манипулятором, стоимость рассчитывает персональный менеджер.
          </InfoPanel>
          <p className="mt-[16px] text-[13px] leading-[20px] text-sub">Точную стоимость и время менеджер подтвердит при согласовании заказа.</p>
        </PriceCard>
      </div>
    </section>
  );
}
