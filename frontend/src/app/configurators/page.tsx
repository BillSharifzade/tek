import type { Metadata } from "next";
import { publicGet } from "@/lib/server";
import { PageHead } from "@/components/content/PageHead";
import { ConfiguratorCard } from "@/components/content/ConfiguratorCard";
import { Steps } from "@/components/content/Blocks";
import { CtaBand } from "@/components/content/CtaBand";
import type { ConfiguratorItem } from "@/components/content/types";

export const metadata: Metadata = {
  title: "Конфигураторы",
  description: "Онлайн-конфигураторы ТЭК: автоматический расчёт элементов кабеленесущих систем и систем организации рабочих мест.",
};

const STEPS = [
  { title: "Выберите конфигуратор", text: "Кабельные лотки Fix Combitech или кабель-каналы для рабочих мест." },
  { title: "Укажите параметры", text: "Длину трассы, ширину лотка, количество поворотов и ответвлений." },
  { title: "Получите комплектацию", text: "Программа рассчитает количество лотков, крышек, консолей и крепежа." },
  { title: "Отправьте менеджеру", text: "Инженер проверит расчёт и подготовит коммерческое предложение." },
];

export default async function ConfiguratorsPage() {
  const items = await publicGet<ConfiguratorItem[]>("/content/configurators", undefined, 300);
  return (
    <div className="container-page pb-[64px] md:pb-[100px]">
      <PageHead crumbs={[{ label: "Конфигураторы" }]} title="Конфигураторы">
        <p className="mt-[12px] max-w-[760px] text-[15px] leading-[24px] text-g333 md:text-[16px] md:leading-[26px]">
          Программы позволяют автоматически рассчитать количество требуемых элементов кабеленесущих систем и систем организации рабочих мест.
        </p>
      </PageHead>
      <ul className="mt-[28px] grid grid-cols-1 gap-[20px] md:mt-[36px] lg:grid-cols-2">
        {items.map((c) => (
          <li key={c.slug}>
            <ConfiguratorCard item={c} />
          </li>
        ))}
      </ul>

      <section className="mt-[56px] md:mt-[90px]">
        <h2 className="text-[22px] font-bold leading-[28px] md:text-[26px] md:leading-[30px]">Как это работает</h2>
        <Steps items={STEPS} className="mt-[28px] md:mt-[40px]" />
      </section>

      <CtaBand className="mt-[56px] md:mt-[90px]" title="Нужен расчёт под проект?" text="Пришлите схему трассы или спецификацию — инженеры ТЭК подберут кабеленесущие системы и подготовят смету." />
    </div>
  );
}
