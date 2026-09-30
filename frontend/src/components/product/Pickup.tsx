import Link from "next/link";
import type { Product } from "@/lib/types";
import { qty as fmtQty } from "@/lib/format";
import { Leader } from "./Specs";
import { IconCheckMark, IconCross, IconPickup } from "./icons";

/**
 * «Самовывоз» (Figma 10380:174): иконка тележки 24×24, заголовок 18/20 600; строки через 28px —
 * магазин (14/20 #1C3697, ссылка) …… остаток (13/20 500, #000 / #666 для нуля) + зелёная галка или серый крест.
 */
export function Pickup({ product, className }: { product: Product; className?: string }) {
  if (product.stock.length === 0) return null;
  return (
    <section className={className} aria-label="Самовывоз">
      <div className="flex h-[24px] items-start">
        <IconPickup className="shrink-0" />
        <h2 className="ml-[9px] mt-[5px] text-[18px] font-semibold leading-[20px] text-black">Самовывоз</h2>
      </div>
      <ul className="mt-[16px] flex flex-col gap-[8px]">
        {product.stock.map((s) => {
          const has = s.qty > 0;
          return (
            <li key={s.store_id} className="flex items-start text-[14px] leading-[20px]">
              <Link href="/contacts" className="max-w-[210px] shrink-0 text-link link-hover" title={`${s.city}, ${s.name}`}>
                {s.name}
              </Link>
              <Leader top={14} className="ml-[5px] mr-[4px]" />
              <span className={has ? "text-[13px] font-medium text-black tnum" : "text-[13px] font-medium text-sub tnum"}>
                {fmtQty(s.qty)} {product.unit}
              </span>
              <span className="ml-[2px] flex h-[20px] w-[14px] shrink-0 items-start justify-center">
                {has ? <IconCheckMark className="mt-[4px]" /> : <IconCross className="mt-[5px]" />}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
