import type { Metadata } from "next";
import { countLabel } from "@/lib/format";
import { PageHead, Lead } from "@/components/content/PageHead";
import { CtaBand } from "@/components/content/CtaBand";
import { VacancyCard } from "@/components/content/VacancyCard";
import { VACANCIES } from "@/components/content/vacancies";

export const metadata: Metadata = {
  title: "Вакансии",
  description: "Вакансии ТЭК — Точикэлектрокомплект: работа в отделе продаж, IT и магазинах компании в Душанбе.",
};

/** Вакансии — отдельная страница (раньше раздел «О компании»); оформление раздела сохранено. */
export default function VacanciesPage() {
  return (
    <div className="container-page pb-[64px] md:pb-[100px]">
      <PageHead
        crumbs={[{ label: "Вакансии" }]}
        title="Вакансии"
        aside={<span className="text-[14px] leading-[20px] text-muted">{countLabel(VACANCIES.length, ["открытая вакансия", "открытые вакансии", "открытых вакансий"])}</span>}
      />
      <Lead className="mt-[12px] max-w-[860px]">
        Присоединяйтесь к команде ТЭК: официальное трудоустройство, обучение у производителей и работа на крупнейших энергетических объектах страны.
      </Lead>
      <div className="mt-[24px] flex flex-col gap-[13px] md:mt-[28px]">
        {VACANCIES.map((v) => (
          <VacancyCard key={v.id} v={v} />
        ))}
      </div>

      <CtaBand className="mt-[56px] md:mt-[90px]" />
    </div>
  );
}
