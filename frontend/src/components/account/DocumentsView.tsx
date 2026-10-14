"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import type { AccountDocument } from "@/lib/types";
import { client, downloadFile } from "@/lib/client";
import { date } from "@/lib/format";
import { toast } from "@/store/toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, type Column } from "./DataTable";
import { Card, CardTitle, ErrorLine, apiPath, errorMessage } from "./shared";

type Doc = AccountDocument & { id: string | number; kind_label?: string; note?: string | null; url: string | null; order_number?: string | null };

const KIND_LABEL: Record<string, string> = { invoice: "Счёт", act: "Акт", contract: "Договор", payment: "Оплата", credit_note: "Корректировка" };

/** «Документы» (макета нет — в стиле ЛК): счета/акты/договоры для скачивания. Сметы — отдельной вкладкой (доработки R5). */
export function DocumentsView() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    client
      .get<Doc[]>("/account/documents")
      .then(setDocs)
      .catch((e) => setError(errorMessage(e)));
  }, []);

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

    </div>
  );
}
