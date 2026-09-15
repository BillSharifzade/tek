import type { Order, OrderStatus as Status } from "@/lib/types";
import { ORDER_STATUS_COLORS } from "@/lib/site";
import { cn } from "@/lib/cn";
import { date } from "@/lib/format";

export function StatusBadge({ status, label, className }: { status: Status | string; label: string; className?: string }) {
  return <span className={cn("inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold", ORDER_STATUS_COLORS[status] ?? "bg-surface text-sub", className)}>{label}</span>;
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
    <ol className="grid grid-cols-5 gap-1" aria-label="Статус заказа">
      {FLOW.map((s, i) => {
        const done = !cancelled && i <= idx;
        const at = eventAt(s.key);
        return (
          <li key={s.key} className="flex flex-col gap-2">
            <span className={cn("h-1.5 rounded-full", cancelled ? "bg-sale/30" : done ? "bg-brand" : "bg-line")} />
            <span className={cn("text-xs font-medium", done ? "text-ink" : "text-muted")}>{s.label}</span>
            {at ? <span className="text-[11px] text-sub tnum">{date(at)}</span> : null}
          </li>
        );
      })}
      {cancelled ? <li className="col-span-5 mt-1 text-sm font-semibold text-sale">Заказ отменён</li> : null}
    </ol>
  );
}
