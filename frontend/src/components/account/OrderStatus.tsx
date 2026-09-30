import type { Order, OrderStatus as Status } from "@/lib/types";
import { cn } from "@/lib/cn";
import { date } from "@/lib/format";

/** Status plates in the palette of the product badges (Figma «Инфо поле»: r3, Roboto Medium). */
const STATUS_CLS: Record<string, string> = {
  new: "bg-hit-bg text-hit",
  confirmed: "bg-brand-light text-black",
  processing: "bg-brand-light text-black",
  shipped: "bg-hit-bg text-hit",
  delivered: "bg-new-bg text-new",
  cancelled: "bg-sale-bg text-sale-text",
};

export function StatusBadge({ status, label, className }: { status: Status | string; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-[20px] items-center whitespace-nowrap rounded-[3px] px-[7px] text-[12px] font-medium leading-[12px]", STATUS_CLS[status] ?? "bg-btn text-g333", className)}>
      {label}
    </span>
  );
}

const FLOW: { key: Status; label: string }[] = [
  { key: "new", label: "Новый" },
  { key: "confirmed", label: "Подтверждён" },
  { key: "processing", label: "В обработке" },
  { key: "shipped", label: "Отгружен" },
  { key: "delivered", label: "Доставлен" },
];

/** Horizontal status timeline for an order (cancelled orders show a red final state). */
export function StatusTimeline({ order }: { order: Order }) {
  const cancelled = order.status === "cancelled";
  const idx = FLOW.findIndex((s) => s.key === order.status);
  const eventAt = (kind: string) => order.events.find((e) => e.kind === kind || e.kind === `status.${kind}`)?.at;
  return (
    <ol className="grid grid-cols-5 gap-[6px]" aria-label="Статус заказа">
      {FLOW.map((s, i) => {
        const done = !cancelled && i <= idx;
        const at = eventAt(s.key);
        return (
          <li key={s.key} className="flex min-w-0 flex-col gap-[8px]" aria-current={!cancelled && i === idx ? "step" : undefined}>
            <span className={cn("h-[4px] rounded-full", cancelled ? "bg-sale-bg" : done ? "bg-brand" : "bg-btn")} />
            <span className={cn("truncate text-[13px] leading-[16px]", done ? "font-medium text-black" : "text-muted")}>{s.label}</span>
            {at ? <span className="-mt-[4px] text-[12px] leading-[14px] text-sub tnum">{date(at)}</span> : null}
          </li>
        );
      })}
      {cancelled ? <li className="col-span-5 mt-[2px] text-[14px] font-medium leading-[20px] text-sale-text">Заказ отменён</li> : null}
    </ol>
  );
}
