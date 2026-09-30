import type { Metadata } from "next";
import { publicGet, safe } from "@/lib/server";
import type { ServiceItem } from "@/components/content/types";
import { SERVICE_CONFIGS, TILE_TEXT } from "@/components/services/data";
import { RequestForm } from "@/components/services/RequestForm";
import { ServiceTiles, type ServiceTile } from "@/components/services/ServiceTiles";

export const metadata: Metadata = {
  title: "Услуги",
  description: "Сервис центр дизельных генераторов, солнечные электростанции под ключ, поддержка в проектировании и другие услуги ТЭК.",
};

/** Услуги из ТЗ — крупными плитками, в этом порядке. */
const MAIN = ["obsluzhivanie-dgu-ibp", "solnechnye-elektrostantsii", "podderzhka-v-proektirovanii"];

export default async function ServicesPage() {
  const api = await safe(publicGet<ServiceItem[]>("/content/services", undefined, 300), [] as ServiceItem[]);

  const main: ServiceTile[] = MAIN.map((slug) => {
    const t = TILE_TEXT[slug];
    const fromApi = api.find((s) => s.slug === slug);
    return { slug, title: t?.title ?? SERVICE_CONFIGS[slug]?.title ?? fromApi?.title ?? slug, text: t?.text ?? fromApi?.short ?? "" };
  });
  const other: ServiceTile[] = api.filter((s) => !MAIN.includes(s.slug)).map((s) => ({ slug: s.slug, title: s.title, text: s.short }));

  return (
    <div className="mx-auto w-full max-w-[1292px] px-4 pb-[93px] min-[1292px]:pl-[17px] min-[1292px]:pr-[15px]">
      <h1 className="pt-[40px] text-[28px] font-bold leading-[32px] text-black md:pt-[50px] md:text-[35px] md:leading-[40px]">Услуги</h1>
      <p className="mt-3 max-w-[640px] text-[16px] leading-[24px] text-sub md:mt-[14px]">
        Сервис и ремонт генераторов, солнечные электростанции под ключ и инженерная поддержка проектировщиков — полный цикл работ по электроснабжению объектов.
      </p>

      <div className="mt-8 md:mt-[40px]">
        <ServiceTiles main={main} other={other} />
      </div>

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
