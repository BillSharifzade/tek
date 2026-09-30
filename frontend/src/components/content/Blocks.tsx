import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconCheckBold } from "./icons";

/**
 * Повторно используемые блоки из макета «Сервис центр ДГУ» (10869:2975) для страниц без собственного макета.
 */

/** «Как мы работаем»: жёлтый круг 42px с номером (Roboto 700 20 #333), заголовок 18 Bold, текст 16/25 #333. */
export function Steps({ items, className }: { items: { title: string; text: ReactNode }[]; className?: string }) {
  return (
    <ol className={cn("grid grid-cols-1 gap-[24px] sm:grid-cols-2 lg:grid-cols-4 lg:gap-[34px]", className)}>
      {items.map((s, i) => (
        <li key={s.title} className="flex gap-[17px]">
          <span className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-brand text-[20px] font-bold leading-[20px] text-g333">{i + 1}</span>
          <div className="pt-[5px]">
            <h3 className="text-[18px] font-bold leading-[22px]">{s.title}</h3>
            <p className="mt-[8px] text-[15px] leading-[23px] text-g333 md:text-[16px] md:leading-[25px]">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Полоса рекомендаций: чёрная галка 31px, заголовок 17/600, текст 15/23 #333. */
export function CheckPoints({ items, className }: { items: { title: string; text: ReactNode }[]; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-1 gap-[24px] sm:grid-cols-2 lg:grid-cols-4 lg:gap-[34px]", className)}>
      {items.map((p) => (
        <li key={p.title} className="flex gap-[14px]">
          <IconCheckBold className="size-[31px] shrink-0" />
          <div className="pt-[4px]">
            <h3 className="text-[17px] font-semibold leading-[22px]">{p.title}</h3>
            <p className="mt-[8px] text-[15px] leading-[23px] text-g333">{p.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Жёлтая заметка «Сообщите заранее»: #FEECBB r7, красный треугольник, жирная подпись + текст 14 #333. */
export function Note({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-[12px] rounded-[7px] bg-brand-light px-[20px] py-[15px] text-[14px] leading-[20px] md:items-center md:px-[26px]", className)}>
      <TriangleAlert className="mt-px size-[20px] shrink-0 text-sale-text md:mt-0" strokeWidth={1.8} aria-hidden />
      <p className="flex flex-col gap-x-[30px] gap-y-1 text-g333 md:flex-row">
        <span className="shrink-0 font-medium text-black">{title}</span>
        <span>{children}</span>
      </p>
    </div>
  );
}

/** Прайс-карта (как «Мощность генератора»): белая r10 с тенью 0 2 8 2 /10%, строки с линией #B3BAC7. */
export function PriceCard({ title, rows, children, className }: { title: string; rows: [ReactNode, ReactNode][]; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[10px] bg-white px-[24px] py-[28px] shadow-card md:px-[34px] md:py-[34px]", className)}>
      <h3 className="text-[16px] font-semibold leading-[20px] text-g333">{title}</h3>
      <dl className="mt-[6px]">
        {rows.map(([k, v], i) => (
          <div key={i} className="flex items-end justify-between gap-4 border-b border-outline pb-[9px] pt-[14px] text-[15px] leading-[20px] md:text-[16px]">
            <dt className="text-sub">{k}</dt>
            <dd className="shrink-0 text-right font-semibold text-g333">{v}</dd>
          </div>
        ))}
      </dl>
      {children}
    </div>
  );
}

/** Сиреневая плашка «Выезд специалиста» (#F4EFFE r7, текст 15/28 #313033). */
export function InfoPanel({ icon, title, children, className }: { icon?: ReactNode; title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[7px] bg-[#F4EFFE] px-[20px] py-[16px] text-[14px] leading-[24px] text-[#313033] md:text-[15px] md:leading-[26px]", className)}>
      {title ? (
        <p className="flex items-center gap-[8px] font-semibold">
          {icon}
          {title}
        </p>
      ) : null}
      <div className={cn(title && "mt-[2px]")}>{children}</div>
    </div>
  );
}
