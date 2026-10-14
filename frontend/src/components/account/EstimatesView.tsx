"use client";

import { useRouter } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { useEffect, useState } from "react";
import type { Estimate } from "@/lib/types";
import { client } from "@/lib/client";
import { date, money } from "@/lib/format";
import { toast } from "@/store/toast";
import { useCart } from "@/store/cart";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card, CardTitle, EmptyState, ErrorLine, btnCls, errorMessage } from "./shared";

/** «Сметы» (доработки R5 — отдельная вкладка меню ЛК, раньше были на странице «Документы»): сохранённые корзины — восстановить или удалить. */
export function EstimatesView() {
  const router = useRouter();
  const loadCart = useCart((s) => s.load);
  const [estimates, setEstimates] = useState<Estimate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // удаление сметы — вторым нажатием («Точно удалить?»)
  const [armedId, setArmedId] = useState<string | null>(null);

  useEffect(() => {
    client
      .get<Estimate[]>("/account/estimates")
      .then(setEstimates)
      .catch((e) => setError(errorMessage(e, "Не удалось загрузить сметы")));
  }, []);

  const restore = async (est: Estimate) => {
    setBusyId(est.id);
    try {
      await client.post(`/account/estimates/${est.id}/restore`, {});
      await loadCart();
      toast.success("Смета восстановлена в корзину", { actionLabel: "Перейти в корзину", actionHref: "/cart" });
      router.push("/cart");
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось восстановить смету"));
      setBusyId(null);
    }
  };

  const remove = async (est: Estimate) => {
    setBusyId(est.id);
    try {
      await client.delete(`/account/estimates/${est.id}`);
      setEstimates((prev) => prev?.filter((x) => x.id !== est.id) ?? prev);
      toast.info("Смета удалена");
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось удалить смету"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardTitle>Сохранённые сметы</CardTitle>
      <ErrorLine error={error} className="mt-[20px]" />
      <div className="mt-[21px]">
        {estimates === null ? (
          error ? null : <Skeleton className="h-[120px] rounded-[7px]" />
        ) : estimates.length === 0 ? (
          <EmptyState>Сохраняйте корзину как смету кнопкой «Сохранить смету» — она появится здесь.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {estimates.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-[16px] gap-y-[12px] py-[14px]">
                <span className="flex size-[44px] shrink-0 items-center justify-center rounded-[7px] bg-surface-2 text-black">
                  <FileSpreadsheet className="size-[22px]" strokeWidth={1.6} aria-hidden />
                </span>
                <span className="min-w-[200px] flex-1">
                  <span className="block text-[15px] font-medium leading-[20px]">{e.name}</span>
                  <span className="block text-[13px] leading-[18px] text-[#555] tnum">
                    {date(e.created_at)} · позиций: {e.items_count} · {money(e.total)}
                  </span>
                </span>
                <div className="flex gap-[10px]">
                  <Button variant="secondary" className={btnCls} loading={busyId === e.id} onClick={() => restore(e)}>
                    Восстановить в корзину
                  </Button>
                  <Button
                    variant={armedId === e.id ? "danger" : "outline"}
                    className={btnCls}
                    disabled={busyId === e.id}
                    onClick={() => (armedId === e.id ? void remove(e) : setArmedId(e.id))}
                    onBlur={() => setArmedId((id) => (id === e.id ? null : id))}
                    aria-label={armedId === e.id ? `Подтвердить удаление сметы ${e.name}` : `Удалить смету ${e.name}`}
                  >
                    {armedId === e.id ? "Точно удалить?" : "Удалить"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
