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

  if (!hydrated || state === "loading") return <Skeleton className="h-48 rounded-[10px]" />;
  if (state === "forbidden") {
    return (
      <p className="rounded-[10px] border border-line bg-white p-[20px] text-[14px] leading-[20px] text-sub">
        Детали заказа доступны в{" "}
        <Link href={`/login?next=/account/orders/${number}`} className="text-black underline underline-offset-[3px]">
          личном кабинете
        </Link>
        .
      </p>
    );
  }
  if (state === "error" || !order) return null;

  return (
    <div className="rounded-[10px] border border-line bg-white p-[20px] sm:p-[30px]">
      <div className="mb-[20px] flex flex-wrap items-center justify-between gap-[12px]">
        <div>
          <p className="text-[20px] font-semibold leading-[24px]">Заказ №{order.number}</p>
          <p className="text-[14px] leading-[20px] text-sub tnum">от {date(order.created_at)}</p>
        </div>
        <StatusBadge status={order.status} label={order.status_label} />
      </div>
      <StatusTimeline order={order} />
      <dl className="mt-[24px] grid grid-cols-1 gap-[12px] text-[14px] leading-[20px] sm:grid-cols-2">
        <div>
          <dt className="text-sub">Получение</dt>
          <dd className="font-medium">
            {order.delivery.method_label}
            {order.delivery.address ? ` · ${order.delivery.address}` : ""}
            {order.delivery.store ? ` · ${order.delivery.store.name}, ${order.delivery.store.address}` : ""}
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
      <ul className="mt-[20px] divide-y divide-line border-t border-line">
        {order.items.map((i) => (
          <li key={i.product.id} className="flex items-center gap-[12px] py-[12px]">
            <ImageBox src={i.product.image} alt={i.product.name} className="size-12 shrink-0 border border-line" sizes="48px" rounded="rounded-[5px]" />
            <span className="min-w-0 flex-1">
              <Link href={`/product/${i.product.slug}`} className="line-clamp-1 text-[14px] leading-[20px] hover:text-black">
                {i.product.name}
              </Link>
              <span className="text-[13px] leading-[17px] text-sub tnum">
                {fmtQty(i.qty)} {i.product.unit} × {money(i.price.price)}
              </span>
            </span>
            <span className="text-[14px] font-medium tnum">{money(i.line_total)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-[16px] flex justify-between border-t border-line pt-[16px] text-[19px] font-semibold leading-[24px] tnum">
        <span>Итого</span>
        <span>{money(order.total)}</span>
      </div>
    </div>
  );
}
