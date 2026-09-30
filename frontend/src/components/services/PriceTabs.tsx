"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import type { PriceTab } from "./types";
import { IconTruck, IconWarnTriangle } from "./icons";
import { RequestButton } from "./RequestButton";

/**
 * Блок «Прайс» (Figma 10922:4174 и табы 10957:2695 / 10958:2057 / 10961:2097 / 10966:2173):
 * слева сегмент-меню 698×41, заголовок 32/22, «Перечень работ», жёлтая плашка-предупреждение;
 * справа карточка 417 с ценами по диапазонам, плашкой «Выезд специалиста» и кнопкой «Оставить заявку».
 * Все панели лежат в одной ячейке грида: высота блока = самой высокой панели, при переключении страница не прыгает.
 */
export function PriceTabs({ tabs, subject }: { tabs: PriceTab[]; subject: string }) {
  const uid = useId();
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  if (tabs.length === 0) return null;
  const multi = tabs.length > 1;

  return (
    <div className="relative">
      {multi ? (
        <div className="scrollbar-none -mx-4 mb-8 overflow-x-auto px-4 lg:absolute lg:left-0 lg:top-0 lg:z-10 lg:mx-0 lg:mb-0 lg:overflow-visible lg:px-0">
          <div role="tablist" aria-label="Виды работ" className="flex h-[41px] w-max gap-[4px] rounded-[10px] bg-btn p-[4px] lg:min-w-[698px]">
            {tabs.map((t) => {
              const on = t.id === activeId;
              return (
                <button
                  key={t.id}
                  id={`${uid}-tab-${t.id}`}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls={`${uid}-panel-${t.id}`}
                  onClick={() => setActiveId(t.id)}
                  className={cn(
                    "h-[33px] grow whitespace-nowrap rounded-[7px] px-[20px] text-[14px] font-medium leading-[20px] transition-colors",
                    on ? "bg-white text-black shadow-soft" : "text-g333 hover:text-black",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid [grid-template-areas:'stack']">
        {tabs.map((t) => {
          const on = t.id === activeId;
          return (
            <div
              key={t.id}
              id={`${uid}-panel-${t.id}`}
              role={multi ? "tabpanel" : undefined}
              aria-labelledby={multi ? `${uid}-tab-${t.id}` : undefined}
              inert={!on}
              className={cn("[grid-area:stack]", on ? "visible" : "invisible")}
            >
              <Panel tab={t} multi={multi} subject={subject} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Panel({ tab, multi, subject }: { tab: PriceTab; multi: boolean; subject: string }) {
  const textOnly = Boolean(tab.text) && !tab.groups;
  return (
    <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-0">
      <div className={cn("min-w-0 lg:w-[698px]", multi && "lg:pt-[41px]")}>
        <h2
          className={cn(
            "text-[26px] font-semibold leading-[30px] text-black lg:text-[32px] lg:leading-[22px]",
            multi && (textOnly ? "lg:mt-[35px]" : "lg:mt-[38px]"),
          )}
        >
          {tab.title}
        </h2>

        {tab.groups ? (
          <div className="mt-6 lg:mt-[34px]">
            {tab.groups.map((g, gi) => (
              <div key={`${g.title}-${gi}`} className={gi > 0 ? "mt-[7px]" : undefined}>
                <h3 className="text-[16px] font-semibold leading-[30px] text-g333">{g.title}</h3>
                <ul className="mt-[3px]">
                  {g.items.map((item, ii) => (
                    <li key={`${item}-${ii}`} className={cn("relative pl-[23px] text-sub", tab.itemSize === 14 ? "text-[14px]/[25px]" : "text-[15px]/[25px]")}>
                      <span aria-hidden className="absolute left-[9.4px] top-[10.4px] size-[2.6px] rounded-full bg-sub" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        {tab.text ? <p className="mt-6 text-[16px] leading-[30px] text-g333 lg:mt-[33px]">{tab.text}</p> : null}

        {tab.html ? <div className="prose-tek mt-6 lg:mt-[33px]" dangerouslySetInnerHTML={{ __html: tab.html }} /> : null}

        {tab.notice ? (
          <div
            className={cn(
              "relative flex min-h-[50px] items-center rounded-[7px] bg-brand-light py-[12px] pl-[54px] pr-4 text-[14px] leading-[18px]",
              tab.itemSize === 14 ? "mt-[27px]" : "mt-[26px]",
            )}
          >
            <IconWarnTriangle className="absolute left-[17px] top-[12px]" />
            <span aria-hidden className="absolute left-[28px] top-[19px] w-[4px] text-center text-[12px] font-semibold leading-[12px] text-sale-text">
              !
            </span>
            {tab.notice.lead ? (
              <p className="flex flex-col gap-1 text-sub sm:flex-row sm:gap-[31.3px]">
                <span className="shrink-0 font-medium text-black">{tab.notice.lead}</span>
                <span>{tab.notice.text}</span>
              </p>
            ) : (
              <p className="font-medium text-black">{tab.notice.text}</p>
            )}
          </div>
        ) : null}
      </div>

      <PriceCard tab={tab} subject={subject} />
    </div>
  );
}

function PriceCard({ tab, subject }: { tab: PriceTab; subject: string }) {
  return (
    <aside aria-label="Стоимость" className="rounded-[10px] bg-white px-5 pb-[29px] pt-[25px] shadow-card sm:px-[34px] lg:w-[417px] lg:shrink-0">
      <h3 className="h-[27px] text-[16px] font-semibold leading-[30px] text-g333">{tab.priceTitle}</h3>
      <dl>
        {tab.prices.map((p) => (
          <div key={p.label} className="flex min-h-[41px] items-start justify-between gap-4 border-b border-outline pb-[4px] pt-[12px] text-[16px] leading-[24px]">
            <dt className="text-sub">{p.label}</dt>
            <dd className="relative top-px text-right font-semibold text-g333">{p.value}</dd>
          </div>
        ))}
      </dl>

      <div className="relative mt-[27px] rounded-[7px] bg-[#F4EFFE] pb-[14.5px] pl-[20px] pr-3 pt-[9.5px] text-[15px] text-[#313033]">
        <IconTruck className="absolute left-[21px] top-[13px]" />
        <p className="pl-[30px] font-medium leading-[28px]">{tab.visit.title}</p>
        <div className="mt-[2px]">
          {tab.visit.lines.map((l) => (
            <p key={l.label} className="leading-[24px]">
              {l.label}
              <b className="font-semibold">{l.value}</b>
            </p>
          ))}
        </div>
      </div>

      <RequestButton note={`${subject} — ${tab.title}`} className="mt-[17px] w-full" />

      <p className="mt-[11px] text-[13px] leading-[20px] text-sub">
        {tab.footnote.map((line, i) => (
          <span key={i} className="lg:block">
            {line}
          </span>
        ))}
      </p>
    </aside>
  );
}
