"use client";

import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet } from "lucide-react";
import { useEffect, useState } from "react";
import type { AccountDocument, Estimate } from "@/lib/types";
import { client, downloadFile } from "@/lib/client";
import { date, money } from "@/lib/format";
import { toast } from "@/store/toast";
import { useCart } from "@/store/cart";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, type Column } from "./DataTable";
import { Card, CardTitle, EmptyState, ErrorLine, apiPath, btnCls, errorMessage } from "./shared";

type Doc = AccountDocument & { id: string | number; kind_label?: string; note?: string | null; url: string | null; order_number?: string | null };

const KIND_LABEL: Record<string, string> = { invoice: "Счёт", act: "Акт", contract: "Договор", payment: "Оплата", credit_note: "Корректировка" };

/** «Документы» (макета нет — в стиле ЛК): счета/акты/договоры для скачивания + сохранённые сметы (восстановить в корзину). */
export function DocumentsView() {
  const router = useRouter();
  const loadCart = useCart((s) => s.load);
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [estimates, setEstimates] = useState<Estimate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // удаление сметы — вторым нажатием («Точно удалить?»)
  const [armedId, setArmedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Documents need the Bearer token, so they are fetched and saved rather than linked directly.
  const download = async (d: Doc) => {
    if (!d.url) return;
    const id = String(d.id);
    setDownloadingId(id);
    try {
      await downloadFile(apiPath(d.url), `${d.number || d.kind}.xlsx`);
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось скачать документ"));
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    Promise.all([client.get<Doc[]>("/account/documents"), client.get<Estimate[]>("/account/estimates")])
      .then(([d, e]) => {
        setDocs(d);
        setEstimates(e);
      })
      .catch((e) => setError(errorMessage(e)));
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

  const columns: Column<Doc>[] = [
    { key: "kind", header: "Тип", className: "w-[130px]", cell: (d) => <span className="font-medium">{d.kind_label ?? KIND_LABEL[d.kind] ?? d.kind}</span> },
    {
      key: "title",
      header: "Название",
      cell: (d) => (
        <span>
          {d.title ?? d.note ?? (d.order_number ? `Заказ ${d.order_number}` : "—")}
          {d.title && d.note ? <span className="block text-[13px] leading-[17px] text-sub">{d.note}</span> : null}
        </span>
      ),
    },
    { key: "number", header: "№", className: "w-[130px]", cell: (d) => <span className="tnum">{d.number}</span> },
    { key: "date", header: "Дата", className: "w-[110px]", cell: (d) => <span className="tnum">{date(d.date)}</span> },
    {
      key: "dl",
      header: "",
      align: "right",
      className: "w-[120px]",
      cell: (d) =>
        d.url ? (
          <button
            type="button"
            onClick={() => download(d)}
            disabled={downloadingId === String(d.id)}
            className="inline-flex items-center gap-[6px] text-[15px] leading-[20px] text-[#555] transition-colors hover:text-black disabled:opacity-50"
          >
            <Download className="size-4" aria-hidden />
            {downloadingId === String(d.id) ? "Загрузка…" : "Скачать"}
          </button>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-[16px] lg:gap-[27px]">
      <Card>
        <CardTitle>Документы</CardTitle>
        <ErrorLine error={error} className="mt-[20px]" />
        <div className="mt-[28px]">
          {docs === null && !error ? <Skeleton className="h-[200px] rounded-[7px]" /> : docs ? <DataTable columns={columns} rows={docs} rowKey={(d) => String(d.id)} empty="Документов пока нет" /> : null}
        </div>
      </Card>

      <Card id="estimates" className="scroll-mt-[130px]">
        <CardTitle>Сохранённые сметы</CardTitle>
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
    </div>
  );
}
