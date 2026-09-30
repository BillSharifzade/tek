import type { Metadata } from "next";
import type { Brand } from "@/lib/types";
import { publicGet } from "@/lib/server";
import { countLabel } from "@/lib/format";
import { PageHead, SectionTitle } from "@/components/content/PageHead";
import { BrandCard } from "@/components/content/BrandCard";
import { CtaBand } from "@/components/content/CtaBand";

export const metadata: Metadata = {
  title: "Бренды",
  description: "Бренды-партнёры ТЭК: ДКС, Schneider Electric, Legrand, Philips, Prysmian, AKSA и другие производители электротехники.",
};

function Grid({ items }: { items: Brand[] }) {
  return (
    <ul className="grid grid-cols-2 gap-[13px] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 lg:gap-[13px]">
      {items.map((b) => (
        <li key={b.slug}>
          <BrandCard brand={b} />
        </li>
      ))}
    </ul>
  );
}

export default async function BrandsPage() {
  const brands = await publicGet<Brand[]>("/brands", undefined, 300);
  const featured = brands.filter((b) => b.is_featured);
  const rest = brands.filter((b) => !b.is_featured).sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return (
    <div className="container-page pb-[64px] md:pb-[100px]">
      <PageHead crumbs={[{ label: "Бренды" }]} title="Бренды" aside={<span className="text-[14px] leading-[20px] text-muted tnum">{countLabel(brands.length, ["бренд", "бренда", "брендов"])}</span>}>
        <p className="mt-[12px] max-w-[760px] text-[15px] leading-[24px] text-g333 md:text-[16px] md:leading-[26px]">
          Широкий выбор оригинальной продукции ведущих мировых производителей электротехники — напрямую от официального дистрибьютора.
        </p>
      </PageHead>

      {featured.length > 0 ? (
        <section className="mt-[32px] md:mt-[44px]">
          <SectionTitle>Официальный дистрибьютор</SectionTitle>
          <div className="mt-[20px] md:mt-[24px]">
            <Grid items={featured} />
          </div>
        </section>
      ) : null}
      {rest.length > 0 ? (
        <section className="mt-[48px] md:mt-[64px]">
          <SectionTitle>Другие бренды в каталоге</SectionTitle>
          <div className="mt-[20px] md:mt-[24px]">
            <Grid items={rest} />
          </div>
        </section>
      ) : null}

      <CtaBand className="mt-[56px] md:mt-[90px]" title="Не нашли нужный бренд?" text="Поставляем продукцию под заказ — пришлите спецификацию, и мы подберём оригинал или аналог." />
    </div>
  );
}
