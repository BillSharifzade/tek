import type { Metadata } from "next";
import { RequestForm } from "@/components/services/RequestForm";
import { DirectionTile, SERVICE_DIRECTIONS } from "@/components/home/Directions";

export const metadata: Metadata = {
  title: "Услуги",
  description: "Услуги ТЭК: сервис центр дизельных генераторов, солнечные электростанции под ключ, помощь проектировщикам.",
};

/** Доработки R2: только услуги из ТЗ — компактными плитками, с иконками и описаниями как на главной. */
const TILES = [SERVICE_DIRECTIONS.generators, SERVICE_DIRECTIONS.solar, SERVICE_DIRECTIONS.designers];

export default function ServicesPage() {
  return (
    <div className="mx-auto w-full max-w-[1292px] px-4 pb-[93px] min-[1292px]:pl-[17px] min-[1292px]:pr-[15px]">
      <h1 className="pt-[40px] text-[28px] font-bold leading-[32px] text-black md:pt-[50px] md:text-[35px] md:leading-[40px]">Услуги</h1>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 md:mt-[40px] lg:grid-cols-3 lg:gap-x-[16px] lg:gap-y-[14px]">
        {TILES.map((t) => (
          <li key={t.href}>
            <DirectionTile t={t} />
          </li>
        ))}
      </ul>

      <section aria-labelledby="services-request" className="mt-16 grid gap-8 rounded-[11px] bg-surface-2 px-5 py-8 lg:mt-[93px] lg:grid-cols-[1fr_584px] lg:gap-[60px] lg:px-[62px] lg:py-[56px]">
        <div>
          <h2 id="services-request" className="text-[26px] font-bold leading-[30px] text-black lg:text-[32px] lg:leading-[38px]">
            Не нашли нужную услугу?
          </h2>
          <p className="mt-4 max-w-[440px] text-[18px] leading-[24px] text-g333">
            Опишите задачу — инженер подберёт решение и подготовит коммерческое предложение в течение одного рабочего дня.
          </p>
        </div>
        <RequestForm service="Услуги: общая заявка" className="lg:pt-[4px]" />
      </section>
    </div>
  );
}
