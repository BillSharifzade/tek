import type { Metadata } from "next";
import { publicGet } from "@/lib/server";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ServiceCard } from "@/components/content/ServiceCard";
import { CtaBand } from "@/components/content/CtaBand";
import type { ServiceItem } from "@/components/content/types";

export const metadata: Metadata = { title: "Услуги" };

export default async function ServicesPage() {
  const services = await publicGet<ServiceItem[]>("/content/services", undefined, 300);
  return (
    <div className="container-page pb-14">
      <Breadcrumbs items={[{ label: "Услуги" }]} />
      <h1>Услуги</h1>
      <p className="mt-2 max-w-2xl text-sub">Поставка, пуско-наладка, сервис и проектная поддержка — полный цикл работ по электроснабжению объектов.</p>
      <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <li key={s.slug}>
            <ServiceCard service={s} />
          </li>
        ))}
      </ul>
      <CtaBand className="mt-14" title="Не нашли нужную услугу?" text="Расскажите о задаче — подготовим коммерческое предложение в течение одного рабочего дня." />
    </div>
  );
}
