import Link from "next/link";
import Image from "next/image";
import type { Brand } from "@/lib/types";
import { countLabel } from "@/lib/format";
import { brandLogo } from "./brands";

/**
 * Плитка бренда: белая карточка r11 с мягкой тенью, как полоса вендоров на лендинге (0 1 7 3 /7%),
 * логотип в зоне 92px, под линией #EBEDF8 — название 15 Bold и «страна · N товаров» 13 #808080.
 */
export function BrandCard({ brand }: { brand: Brand }) {
  const logo = brandLogo(brand);
  return (
    <Link
      href={`/brands/${brand.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[11px] bg-white shadow-[0_1px_7px_3px_rgba(0,0,0,0.07)] transition-shadow hover:shadow-[0_2px_10px_3px_rgba(0,0,0,0.12)]"
    >
      <span className="flex h-[92px] items-center justify-center px-[20px]">
        {logo ? (
          <Image src={logo} alt={brand.name} width={150} height={48} unoptimized className="h-auto max-h-[42px] w-auto max-w-[140px] object-contain transition-transform duration-200 group-hover:scale-105" />
        ) : (
          <span className="text-[18px] font-bold">{brand.name}</span>
        )}
      </span>
      <span className="flex flex-1 flex-col border-t border-line-2 px-[16px] py-[12px]">
        <span className="text-[15px] font-bold leading-[20px] text-black">{brand.name}</span>
        <span className="mt-[2px] text-[13px] leading-[18px] text-muted">
          {brand.country_brand ? `${brand.country_brand} · ` : ""}
          {brand.product_count > 0 ? countLabel(brand.product_count, ["товар", "товара", "товаров"]) : "под заказ"}
        </span>
      </span>
    </Link>
  );
}
