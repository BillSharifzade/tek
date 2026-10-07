import { SITE } from "@/lib/site";
import { ButtonLink } from "@/components/ui/Button";
import type { Vacancy } from "./vacancies";

/** Карточка вакансии (раскрывается): отдел, должность, город / опыт / график, зарплата; внутри — обязанности, требования, условия. */
export function VacancyCard({ v }: { v: Vacancy }) {
  const mail = `mailto:${SITE.email}?subject=${encodeURIComponent(`Резюме: ${v.title}`)}`;
  return (
    <details className="group rounded-[11px] bg-surface-2 transition-shadow open:shadow-card" id={v.id}>
      <summary className="flex cursor-pointer list-none flex-col gap-[14px] px-[20px] py-[22px] marker:content-none md:flex-row md:items-center md:justify-between md:gap-6 md:px-[28px] md:py-[24px] [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-[13px] leading-[18px] text-muted">{v.dept}</p>
          <h3 className="mt-[4px] text-[18px] font-bold leading-[24px] transition-colors group-hover:text-black md:text-[20px] md:leading-[26px]">{v.title}</h3>
          <ul className="mt-[12px] flex flex-wrap gap-[8px]">
            {[v.city, v.experience, v.schedule].map((t) => (
              <li key={t} className="inline-flex h-[24px] items-center rounded-[15px] bg-white px-[11px] text-[13px] leading-[18px] text-g333">
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-[20px] md:justify-end">
          <span className="text-[18px] font-bold leading-[24px] md:text-[20px]">{v.salary}</span>
          <span className="flex size-[36px] items-center justify-center rounded-full bg-white transition-colors group-hover:bg-btn-hover">
            <svg width="10" height="5" viewBox="0 0 10 5" aria-hidden className="text-[#333] transition-transform group-open:rotate-180">
              <path d="M0 0h10L5 5z" fill="currentColor" />
            </svg>
          </span>
        </div>
      </summary>
      <div className="border-t border-line-3 px-[20px] pb-[24px] pt-[22px] md:px-[28px] md:pb-[28px]">
        <div className="grid grid-cols-1 gap-[24px] md:grid-cols-3 md:gap-[32px]">
          {v.blocks.map((b) => (
            <div key={b.title}>
              <h4 className="text-[16px] font-semibold leading-[20px]">{b.title}</h4>
              <ul className="mt-[10px] flex flex-col gap-[6px] text-[14px] leading-[21px] text-g333">
                {b.items.map((it) => (
                  <li key={it} className="relative pl-[16px] before:absolute before:left-[3px] before:top-[8px] before:size-[5px] before:rounded-full before:bg-[#B3BAC7] before:content-['']">
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-[24px] flex flex-col gap-[12px] sm:flex-row sm:items-center sm:gap-[20px]">
          <ButtonLink href={mail} className="px-[24px]">
            Отправить резюме
          </ButtonLink>
          <span className="text-[13px] leading-[18px] text-muted">
            или напишите на{" "}
            <a href={`mailto:${SITE.email}`} className="text-g333 underline underline-offset-2 hover:text-black">
              {SITE.email}
            </a>
          </span>
        </div>
      </div>
    </details>
  );
}
