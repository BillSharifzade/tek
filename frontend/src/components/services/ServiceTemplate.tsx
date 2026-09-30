import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ServiceConfig } from "./types";
import { IconCheckBold, IconCheckCircle } from "./icons";
import { PriceTabs } from "./PriceTabs";
import { RequestButton, REQUEST_ANCHOR } from "./RequestButton";
import { RequestForm } from "./RequestForm";
import { ScheduleTable } from "./ScheduleTable";
import { SegmentNav, type SegmentItem } from "./SegmentNav";
import { ServiceFaq } from "./ServiceFaq";

/** Колонка контента как в макете: x = 127…1387 на холсте 1512. */
const COL = "mx-auto w-full max-w-[1292px] px-4 min-[1292px]:pl-[17px] min-[1292px]:pr-[15px]";
/** Отступ якорей под липкие шапку (114) и навигацию (72). */
const ANCHOR = "scroll-mt-[90px] lg:scroll-mt-[210px]";

const H2 = "text-[26px] font-bold leading-[30px] text-black lg:text-[32px] lg:leading-[22px]";

/**
 * Единый шаблон страницы услуги — 1:1 с Figma «Сервис центр ДГУ» (10869:2975) / «Солнечная энергетика» (10980:2221).
 * Все тексты, цены, шаги и FAQ приходят из конфига страницы.
 */
export function ServiceTemplate({ config: c }: { config: ServiceConfig }) {
  const nav: SegmentItem[] = [
    { id: "order", label: "Заказать услугу", weight: 252 },
    { id: "catalog", label: "Каталог услуг", weight: 216 },
    { id: "how", label: "Как мы работаем", weight: 272 },
    ...(c.schedule ? [{ id: "schedule", label: c.schedule.navLabel, weight: 222 }] : []),
    { id: "faq", label: "Вопросы и ответы", weight: 290 },
  ];

  return (
    <div className="pb-[93px]">
      {/* липкая навигация: родитель — вся страница услуги, чтобы полоса держалась до конца */}
      <div className="relative z-30 bg-white lg:sticky lg:top-[114px]">
        <div className={COL}>
          <SegmentNav items={nav} />
        </div>
      </div>

      <div className={COL}>

        {/* ── hero ─────────────────────────────────────────────── */}
        <section id="order" aria-labelledby="svc-title" className={cn(ANCHOR, "relative overflow-hidden rounded-[11px] bg-surface-2 lg:h-[475px]")}>
          <div className="relative aspect-[572/475] w-full lg:absolute lg:right-0 lg:top-0 lg:aspect-auto lg:h-full lg:w-[572px]">
            <Image
              src={c.hero.image}
              alt=""
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 572px"
              className={c.hero.imageFit === "contain" ? "object-contain p-8" : "object-cover"}
            />
          </div>
          <div className="px-5 pb-8 pt-7 lg:pl-[62px] lg:pr-0 lg:pt-[65px]">
            <h1 id="svc-title" className="text-[30px] font-bold leading-[38px] text-black lg:max-w-[540px] lg:text-[40px] lg:leading-[52px]">
              {c.hero.title}
            </h1>
            <ul className="mt-6 grid grid-cols-2 gap-y-[21px] sm:grid-cols-[188px_188px] lg:ml-[2px] lg:mt-[32px]">
              {c.hero.checks.map((t) => (
                <li key={t} className="flex items-start gap-[7px] text-[16px] leading-[15px] text-black">
                  <IconCheckCircle className="shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
            <RequestButton note={c.requestSubject} className="mt-8 w-[175px] lg:ml-px lg:mt-[40px]" />
          </div>
        </section>

        {/* ── жёлтая плашка с преимуществами (наезжает на hero) ─────────────── */}
        <ul className="relative z-10 mx-4 -mt-6 grid gap-5 rounded-[11px] bg-brand px-6 py-5 shadow-[0_2px_8px_2px_rgba(0,0,0,0.13)] sm:grid-cols-3 lg:mx-0 lg:ml-[160px] lg:-mt-[55px] lg:h-[111px] lg:w-[938px] lg:grid-cols-[200px_200px_200px] lg:gap-x-[90px] lg:pl-[79px] lg:pr-0 lg:pt-[23px]">
          {c.advantages.map((a) => (
            <li key={a.title} className="text-black">
              <p className="text-[16px] font-bold leading-[17px]">{a.title}</p>
              <p className="mt-[7px] text-[14px] leading-[20px]">{a.text}</p>
            </li>
          ))}
        </ul>

        {/* ── прайс ─────────────────────────────────────────── */}
        <section id="catalog" aria-label="Каталог услуг" className={cn(ANCHOR, "mt-12 lg:mt-[67px]")}>
          <PriceTabs tabs={c.tabs} subject={c.requestSubject} />
        </section>

        {/* ── как мы работаем ───────────────────────────────────── */}
        <section id="how" aria-labelledby="svc-how" className={cn(ANCHOR, "mt-16 lg:mt-[92px]")}>
          <h2 id="svc-how" className={H2}>
            Как мы работаем
          </h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:mt-[56px] lg:grid-cols-[289px_289px_289px_289px] lg:gap-x-[34px]">
            {c.steps.map((s, i) => (
              <li key={s.title} className="relative min-h-[42px] pl-[59px] pt-[5px]">
                <span className="absolute left-0 top-0 grid size-[42px] place-items-center rounded-full bg-brand text-[20px] font-bold leading-[20px] text-g333">
                  {i + 1}
                </span>
                <p className="text-[18px] font-bold leading-[17px] text-black">{s.title}</p>
                <p className="mt-[9.5px] max-w-[230px] text-[16px] leading-[25px] text-g333">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* ── серая полоса: фото + кнопка ────────────────────────── */}
      {c.promo ? (
        <section aria-labelledby="svc-promo" className="mt-16 bg-btn lg:mt-[94px]">
          <div className={cn(COL, "flex flex-col-reverse gap-8 py-10 lg:h-[456px] lg:flex-row lg:items-start lg:justify-between lg:gap-0 lg:py-0")}>
            <div className="lg:w-[508px] lg:pt-[60px]">
              <h2 id="svc-promo" className="text-[26px] font-bold leading-[34px] text-black lg:text-[32px] lg:leading-[45px]">
                {c.promo.title}
              </h2>
              <p className="mt-4 text-[18px] leading-[25px] text-g333 lg:mt-[19px] lg:w-[500px]">{c.promo.text}</p>
              {c.promo.href ? (
                <Link
                  href={c.promo.href}
                  className="mt-8 inline-flex h-[54px] items-center rounded-[7px] bg-brand px-[24px] text-[16px] font-medium leading-[24px] text-black transition-colors hover:bg-brand-hover lg:mt-[34px]"
                >
                  {c.promo.cta}
                </Link>
              ) : (
                <a
                  href="#schedule"
                  className="mt-8 inline-flex h-[54px] items-center rounded-[7px] bg-brand px-[24px] text-[16px] font-medium leading-[24px] text-black transition-colors hover:bg-brand-hover lg:mt-[34px]"
                >
                  {c.promo.cta}
                </a>
              )}
            </div>
            <div className="relative aspect-[662/319] w-full overflow-hidden rounded-[10px] lg:mr-px lg:mt-[66px] lg:w-[662px] lg:shrink-0">
              <Image src={c.promo.image} alt="" fill sizes="(max-width: 1023px) 100vw, 662px" className="object-cover" />
            </div>
          </div>
        </section>
      ) : null}

      {/* ── полоса из 4 советов ─────────────────────────────── */}
      {c.tips ? (
        <section aria-label="Рекомендации" className={cn("bg-surface", !c.promo && "mt-16 lg:mt-[94px]")}>
          <ul className={cn(COL, "grid gap-6 py-8 sm:grid-cols-2 lg:h-[179px] lg:grid-cols-[275px_275px_275px_275px] lg:gap-x-[53px] lg:py-0 lg:pt-[36px]")}>
            {c.tips.map((t) => (
              <li key={t.title} className="relative pl-[45px]">
                <IconCheckBold className="absolute left-0 top-0 text-black" />
                <p className="pt-[4px] text-[17px] font-semibold leading-[17px] text-black">{t.title}</p>
                <p className="mt-[12px] text-[15px] leading-[23px] text-g333 lg:w-[230px]">{t.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className={COL}>
        {c.schedule ? (
          <section id="schedule" aria-labelledby="svc-schedule" className={cn(ANCHOR, "mt-16 lg:mt-[72px]")}>
            <h2 id="svc-schedule" className={H2}>
              {c.schedule.title}
            </h2>
            <div className="mt-8 lg:mt-[43px]">
              <ScheduleTable data={c.schedule} />
            </div>
          </section>
        ) : null}

        {/* ── FAQ + заявка ───────────────────────────────────── */}
        <div
          className={cn(
            "grid gap-12 lg:grid-cols-[584px_584px] lg:justify-between lg:gap-0",
            c.schedule ? "mt-16 lg:mt-[103px]" : "mt-16 lg:mt-[93px]",
          )}
        >
          <section id="faq" aria-labelledby="svc-faq" className={ANCHOR}>
            <h2 id="svc-faq" className={H2}>
              Часто задаваемые вопросы
            </h2>
            <ServiceFaq items={c.faq} />
          </section>
          <section id={REQUEST_ANCHOR} aria-labelledby="svc-request" className={ANCHOR}>
            <h2 id="svc-request" className={H2}>
              Оставьте заявку
            </h2>
            <p className="mt-4 text-[18px] leading-[24px] text-g333 lg:mt-[25px]">Оставьте заявку, и наши специалисты свяжутся с вами.</p>
            <RequestForm service={c.requestSubject} />
          </section>
        </div>
      </div>
    </div>
  );
}
