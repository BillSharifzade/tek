"use client";

import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { AccountDocument, Estimate } from "@/lib/types";
import { client, downloadFile } from "@/lib/client";
import { date, money } from "@/lib/format";
import { toast } from "@/store/toast";
import { useCart } from "@/store/cart";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, type Column } from "./DataTable";
import { EmptyState, ErrorLine, PageTitle, apiPath, errorMessage } from "./shared";

type Doc = AccountDocument & { id: string | number; kind_label?: string; note?: string | null; url: string | null; order_number?: string | null };

const KIND_LABEL: Record<string, string> = { invoice: "Счёт", act: "Акт", contract: "Договор", payment: "Оплата", credit_note: "Корректировка" };

export function DocumentsView() {
  const router = useRouter();
  const loadCart = useCart((s) => s.load);
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [estimates, setEstimates] = useState<Estimate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
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
    { key: "kind", header: "Тип", cell: (d) => <span className="font-medium">{d.kind_label ?? KIND_LABEL[d.kind] ?? d.kind}</span> },
    {
      key: "title",
      header: "Название",
      cell: (d) => (
        <span>
          {d.title ?? d.note ?? (d.order_number ? `Заказ ${d.order_number}` : "—")}
          {d.title && d.note ? <span className="block text-xs text-sub">{d.note}</span> : null}
        </span>
      ),
    },
    { key: "number", header: "№", cell: (d) => <span className="tnum">{d.number}</span> },
    { key: "date", header: "Дата", cell: (d) => <span className="tnum">{date(d.date)}</span> },
    {
      key: "dl",
      header: "",
      align: "right",
      cell: (d) =>
        d.url ? (
          <button
            type="button"
            onClick={() => download(d)}
            disabled={downloadingId === String(d.id)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-info hover:underline disabled:opacity-50"
          >
            <Download className="size-4" aria-hidden />
            {downloadingId === String(d.id) ? "Загрузка…" : "Скачать"}
          </button>
        ) : (
          <span className="text-sm text-muted">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Документы</PageTitle>
      <ErrorLine error={error} />
      {docs === null && !error ? <Skeleton className="h-64" /> : docs ? <DataTable columns={columns} rows={docs} rowKey={(d) => String(d.id)} empty="Документов пока нет" /> : null}

      <section>
        <h3 className="mb-3">Сохранённые сметы</h3>
        {estimates === null ? (
          <Skeleton className="h-32" />
        ) : estimates.length === 0 ? (
          <EmptyState>Сохраняйте корзину как смету кнопкой «Сохранить смету» — она появится здесь.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {estimates.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-4 rounded-[8px] border border-line bg-white p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-surface text-ink">
                  <FileSpreadsheet className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-[200px] flex-1">
                  <span className="block text-base font-semibold">{e.name}</span>
                  <span className="block text-sm text-sub tnum">
                    {date(e.created_at)} · позиций: {e.items_count} · {money(e.total)}
                  </span>
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" icon={<RotateCcw className="size-4" />} loading={busyId === e.id} onClick={() => restore(e)}>
                    Восстановить в корзину
                  </Button>
                  <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" />} disabled={busyId === e.id} onClick={() => remove(e)} aria-label={`Удалить смету ${e.name}`}>
                    Удалить
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
