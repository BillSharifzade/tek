import type { Metadata } from "next";
import { publicGet } from "@/lib/server";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ConfiguratorCard } from "@/components/content/ConfiguratorCard";
import type { ConfiguratorItem } from "@/components/content/types";

export const metadata: Metadata = { title: "Конфигураторы" };

export default async function ConfiguratorsPage() {
  const items = await publicGet<ConfiguratorItem[]>("/content/configurators", undefined, 300);
  return (
    <div className="container-page pb-14">
      <Breadcrumbs items={[{ label: "Конфигураторы" }]} />
      <h1>Конфигураторы</h1>
      <p className="mt-2 max-w-2xl text-md text-sub">Программа позволяет автоматически рассчитать количество требуемых элементов кабеленесущих систем и систем организации рабочих мест</p>
      <ul className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        {items.map((c) => (
          <li key={c.slug}>
            <ConfiguratorCard item={c} />
          </li>
        ))}
      </ul>
    </div>
  );
}
