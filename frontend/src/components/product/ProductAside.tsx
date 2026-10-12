import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { asset } from "@/lib/asset";
import { FLAG_ISO } from "@/lib/countries";
import { AsideHead } from "./Documents";
import { IconSetting } from "./icons";

/** Флаг 17×12 (как в макете); страны без флага — серая плашка. */
function Flag({ country }: { country: string }) {
  const iso = FLAG_ISO[country.trim()];
  if (!iso) return <span aria-hidden className="h-[12px] w-[17px] shrink-0 bg-line-3" />;
  return (
    // маленькая статичная SVG из /public — next/image не нужен
    // eslint-disable-next-line @next/next/no-img-element
    <img src={asset(`/flags/${iso}.svg`)} alt="" width={17} height={12} loading="lazy" className="h-[12px] w-[17px] shrink-0 object-cover shadow-[0_0_0_0.5px_rgba(0,0,0,0.12)]" />
  );
}

/** Логотип бренда: для ДКС — логотип из макета. */
function brandLogo(product: Product): string | null {
  if (product.brand.slug === "dks") return "/figma/dkc-logo.png";
  return product.brand.logo ?? null;
}

/** «Инфа о бренде» (Figma 8612:295): 305×142, бренд 16/20 600, «Все товары >» #1C3697, страны с флагами (шаг 25), логотип справа. */
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
      <ul className="mt-[17px] flex flex-col gap-[10px] text-[14px] leading-[15px] text-sub">
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

/** «Сервисы» (Figma 8612:310): кнопки конфигураторов 250×55 (x 1109…1359 — на 1px правее линии), #EEF0F2, r10, шестерёнка 25×25 + текст 14/19 500 #333. */
export function ServicesCard({ product }: { product: Product }) {
  const links = product.configurator ? [product.configurator] : [];
  if (links.length === 0) return null;
  return (
    <section className="rounded-[10px] bg-white pb-[26px] pl-[26px] pr-[28px] shadow-pop" aria-label="Сервисы">
      <AsideHead>Сервисы</AsideHead>
      <ul className="mt-[20px] flex flex-col gap-[11px]">
        {links.map((c) => (
          <li key={c.url}>
            <Link href={c.url} className="ml-px flex min-h-[55px] items-center rounded-[10px] bg-btn py-[8px] pl-[14px] pr-[14px] transition-colors hover:bg-btn-hover">
              <IconSetting className="shrink-0" />
              <span className="ml-[12px] text-[14px] font-medium leading-[19px] text-g333">{c.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
