"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Order } from "@/lib/types";
import { client } from "@/lib/client";
import { ApiError } from "@/lib/api";
import { date, money, qty as fmtQty } from "@/lib/format";
import { useHydrated } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/Skeleton";
import { ImageBox } from "@/components/ui/ImageBox";
import { StatusBadge, StatusTimeline } from "./OrderStatus";

const LAST_ORDER_EMAIL = "tek_last_order_email";

export function rememberOrderEmail(email: string) {
  try {
    sessionStorage.setItem(LAST_ORDER_EMAIL, email);
  } catch {
    /* ignore */
  }
}

/** Order card used on the checkout success page (works for guests via the e-mail used at checkout). */
export function OrderSummaryCard({ number }: { number: string }) {
  const hydrated = useHydrated();
  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "forbidden" | "error">("loading");

  useEffect(() => {
    let email: string | null = null;
    try {
      email = sessionStorage.getItem(LAST_ORDER_EMAIL);
    } catch {
      /* ignore */
    }
    client
      .get<Order>(`/orders/${number}`, email ? { email } : undefined)
      .then((o) => {
        setOrder(o);
        setState("ok");
      })
      .catch((e) => setState(e instanceof ApiError && (e.status === 401 || e.status === 403) ? "forbidden" : "error"));
  }, [number]);

  if (!hydrated || state === "loading") return <Skeleton className="h-48" />;
  if (state === "forbidden") {
    return (
      <p className="rounded-[8px] border border-line bg-white p-5 text-sm text-sub">
        Детали заказа доступны в{" "}
        <Link href={`/login?next=/account/orders/${number}`} className="text-info hover:underline">
          личном кабинете
        </Link>
        .
      </p>
    );
  }
  if (state === "error" || !order) return null;

  return (
    <div className="rounded-[8px] border border-line bg-white p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">Заказ №{order.number}</p>
          <p className="text-sm text-sub tnum">от {date(order.created_at)}</p>
        </div>
        <StatusBadge status={order.status} label={order.status_label} />
      </div>
      <StatusTimeline order={order} />
      <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-sub">Получение</dt>
          <dd className="font-medium">
            {order.delivery.method_label}
            {order.delivery.address ? ` · ${order.delivery.address}` : ""}
            {order.delivery.store ? ` · ${order.delivery.store}` : ""}
            {order.delivery.date ? ` · ${date(order.delivery.date)}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-sub">Оплата</dt>
          <dd className="font-medium">
            {order.payment.method_label} · {order.payment.status_label}
          </dd>
        </div>
      </dl>
      <ul className="mt-5 divide-y divide-line border-t border-line">
        {order.items.map((i) => (
          <li key={i.product.id} className="flex items-center gap-3 py-3">
            <ImageBox src={i.product.image} alt={i.product.name} className="size-12 shrink-0 border border-line" sizes="48px" rounded="rounded-[4px]" />
            <span className="min-w-0 flex-1">
              <Link href={`/product/${i.product.slug}`} className="line-clamp-1 text-sm hover:text-brand-hover">
                {i.product.name}
              </Link>
              <span className="text-xs text-sub tnum">
                {fmtQty(i.qty)} {i.product.unit} × {money(i.price.price)}
              </span>
            </span>
            <span className="text-sm font-semibold tnum">{money(i.line_total)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-between border-t border-line pt-4 text-lg font-semibold tnum">
        <span>Итого</span>
        <span>{money(order.total)}</span>
      </div>
    </div>
  );
}
