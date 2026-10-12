import type { Attribute } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * Точечный лидер из макета: штрих 2px / пробел 2px, #B3BAC7, 1px. top — от верха строки (≈ базовая линия).
 * Штрих в середине плитки и `round` (целое число плиток) — пунктир начинается и заканчивается одинаковым полупробелом,
 * поэтому отступы до подписи и до значения равны (доработки R3).
 */
export function Leader({ top, className }: { top: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative h-px min-w-[12px] flex-1 bg-[linear-gradient(to_right,transparent_1px,#B3BAC7_1px,#B3BAC7_3px,transparent_3px)] bg-[length:4px_1px] [background-repeat:round_no-repeat]",
        className,
      )}
      style={{ top }}
    />
  );
}

/**
 * Список характеристик «подпись …… значение» (Figma «Характеристики»):
 * строки 14/21, между строками 13px (шаг 34), подпись #666, значение #000, лидер по базовой линии.
 * align="right" — значение прижато вправо (блок у галереи), align="column" — значение в колонке 167px (блок описания).
 */
export function SpecRows({ items, align, labelWidth, className }: { items: Attribute[]; align: "right" | "column"; labelWidth: number; className?: string }) {
  return (
    <dl className={cn("flex flex-col gap-[13px]", className)}>
      {items.map((a) => (
        <div key={a.name} className={cn("flex items-start text-[14px] leading-[21px]", align === "column" && "xl:grid xl:grid-cols-[1fr_167px]")}>
          <div className="flex min-w-0 flex-1 items-start">
            <dt className="shrink-0 text-sub" style={{ maxWidth: labelWidth }}>
              {a.name}
            </dt>
            {/* одинаковые отступы до подписи и до значения (доработки R3) */}
            <Leader top={16} className="mx-[6px]" />
          </div>
          <dd className={cn("min-w-0 text-black", align === "right" ? "max-w-[154px] text-right" : "max-w-[50%] xl:max-w-none")}>{a.value}</dd>
        </div>
      ))}
    </dl>
  );
}
