import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { AsideHead } from "./Documents";
import { IconSetting } from "./icons";

/** Флаги 17×12 (три полосы по 4px, как в макете). */
const FLAGS: Record<string, [string, string, string]> = {
  Россия: ["#FFFFFF", "#0039A6", "#D52B1E"],
  Германия: ["#000000", "#DD0000", "#FFCE00"],
  Италия: ["#009246", "#FFFFFF", "#CE2B37"],
  Франция: ["#0055A4", "#FFFFFF", "#EF4135"],
  Беларусь: ["#C8313E", "#C8313E", "#4AA657"],
  Таджикистан: ["#CC0000", "#FFFFFF", "#006600"],
  Узбекистан: ["#1EB53A", "#FFFFFF", "#0099B5"],
  Казахстан: ["#00AFCA", "#00AFCA", "#00AFCA"],
  Турция: ["#E30A17", "#E30A17", "#E30A17"],
  Китай: ["#DE2910", "#DE2910", "#DE2910"],
};

function Flag({ country }: { country: string }) {
  const f = FLAGS[country] ?? ["#D9DDE4", "#B3BAC7", "#808080"];
  const vertical = country === "Италия" || country === "Франция";
  return (
    <span aria-hidden className={vertical ? "flex h-[12px] w-[17px] shrink-0 shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.12)]" : "flex h-[12px] w-[17px] shrink-0 flex-col shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.12)]"}>
      {f.map((c, i) => (
        <span key={i} className="flex-1" style={{ background: c }} />
      ))}
    </span>
  );
}

/** Логотип бренда: для ДКС — логотип из макета. */
function brandLogo(product: Product): string | null {
  if (product.brand.slug === "dks") return "/figma/dkc-logo.png";
  return product.brand.logo ?? null;
}

/** «Инфа о бренде» (Figma 8612:295): 305×142, бренд 16/20 600, «Все товары >» #1C3697, страны с флагами, логотип справа. */
export function BrandCard({ product }: { product: Product }) {
  const b = product.brand;
  const logo = brandLogo(product);
  return (
    <section className="relative min-h-[142px] rounded-[10px] bg-white pb-[20px] pl-[26px] pr-[23px] pt-[18px] shadow-pop" aria-label="Бренд">
      <p className="text-[16px] font-semibold leading-[20px] text-black">{b.name}</p>
      <Link href={`/brands/${b.slug}`} className="mt-[8px] inline-block text-[14px] leading-[15px] text-link link-hover">
        Все товары &gt;
      </Link>
      {logo ? (
        <Link href={`/brands/${b.slug}`} className="absolute right-[23px] top-[17px] block h-[40px] w-[119px]" aria-label={`Бренд ${b.name}`}>
          <Image src={logo} alt={b.name} fill sizes="119px" className="object-contain" />
        </Link>
      ) : null}
      <ul className="mt-[18px] flex flex-col gap-[9px] text-[14px] leading-[15px] text-sub">
        {b.country_brand ? (
          <li className="flex items-center gap-[7px]">
            <Flag country={b.country_brand} />
            {b.country_brand} - страна бренда
          </li>
        ) : null}
        {b.country_origin ? (
          <li className="flex items-center gap-[7px]">
            <Flag country={b.country_origin} />
            {b.country_origin} - страна производства
          </li>
        ) : null}
      </ul>
    </section>
  );
}

/** «Сервисы» (Figma 8612:310): кнопки конфигураторов 250×55, #EEF0F2, r10, шестерёнка 25×25 + текст 14/19 500 #333. */
export function ServicesCard({ product }: { product: Product }) {
  const links = product.configurator ? [product.configurator] : [];
  if (links.length === 0) return null;
  return (
    <section className="rounded-[10px] bg-white pb-[26px] pl-[26px] pr-[28px] shadow-pop" aria-label="Сервисы">
      <AsideHead>Сервисы</AsideHead>
      <ul className="mt-[20px] flex flex-col gap-[11px]">
        {links.map((c) => (
          <li key={c.url}>
            <Link href={c.url} className="flex min-h-[55px] items-center rounded-[10px] bg-btn py-[8px] pl-[14px] pr-[14px] transition-colors hover:bg-btn-hover">
              <IconSetting className="shrink-0" />
              <span className="ml-[12px] text-[14px] font-medium leading-[19px] text-g333">{c.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
