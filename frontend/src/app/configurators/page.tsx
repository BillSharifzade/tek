import type { Metadata } from "next";
import { publicGet } from "@/lib/server";
import { PageHead } from "@/components/content/PageHead";
import { ConfiguratorCard } from "@/components/content/ConfiguratorCard";
import { CtaBand } from "@/components/content/CtaBand";
import type { ConfiguratorItem } from "@/components/content/types";

export const metadata: Metadata = {
  title: "Конфигураторы",
  description: "Онлайн-конфигураторы ТЭК: автоматический расчёт элементов кабеленесущих систем и систем организации рабочих мест.",
};

export default async function ConfiguratorsPage() {
  const items = await publicGet<ConfiguratorItem[]>("/content/configurators", undefined, 300);
  return (
    <div className="container-page pb-[64px] md:pb-[100px]">
      <PageHead crumbs={[{ label: "Конфигураторы" }]} title="Конфигураторы" />
      <ul className="mt-[28px] grid grid-cols-1 gap-[20px] md:mt-[36px] lg:grid-cols-2">
        {items.map((c) => (
          <li key={c.slug}>
            <ConfiguratorCard item={c} />
          </li>
        ))}
      </ul>

      <CtaBand className="mt-[56px] md:mt-[90px]" title="Нужен расчёт под проект?" text="Пришлите схему трассы или спецификацию — инженеры ТЭК подберут кабеленесущие системы и подготовят смету." />
    </div>
  );
}
