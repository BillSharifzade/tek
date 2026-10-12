import type { Metadata } from "next";
import { countLabel } from "@/lib/format";
import { publicGet, safe } from "@/lib/server";
import { PageHead, Lead } from "@/components/content/PageHead";
import { CtaBand } from "@/components/content/CtaBand";
import { VacancyCard } from "@/components/content/VacancyCard";
import type { Vacancy } from "@/components/content/vacancies";

export const metadata: Metadata = {
  title: "Вакансии",
  description: "Вакансии ТЭК — Точикэлектрокомплект: работа в отделе продаж, IT и магазинах компании в Душанбе.",
};

/** Вакансии — отдельная страница (раньше раздел «О компании»); оформление раздела сохранено. Вакансии правятся в панели. */
export default async function VacanciesPage() {
  const vacancies = await safe(publicGet<Vacancy[]>("/content/vacancies", undefined, 120), []);
  return (
    <div className="container-page pb-[64px] md:pb-[100px]">
      <PageHead
        crumbs={[{ label: "Вакансии" }]}
        title="Вакансии"
        aside={<span className="text-[14px] leading-[20px] text-muted">{vacancies.length ? countLabel(vacancies.length, ["открытая вакансия", "открытые вакансии", "открытых вакансий"]) : "нет открытых вакансий"}</span>}
      />
      <Lead className="mt-[12px] max-w-[860px]">
        Присоединяйтесь к команде ТЭК: официальное трудоустройство, обучение у производителей и работа на крупнейших энергетических объектах страны.
      </Lead>
      <div className="mt-[24px] flex flex-col gap-[13px] md:mt-[28px]">
        {vacancies.map((v) => (
          <VacancyCard key={v.id} v={v} />
        ))}
        {vacancies.length === 0 ? <p className="text-[15px] leading-[24px] text-g333">Открытых вакансий сейчас нет. Пришлите резюме — мы свяжемся, когда появится подходящая позиция.</p> : null}
      </div>

      <CtaBand className="mt-[56px] md:mt-[90px]" />
    </div>
  );
}
