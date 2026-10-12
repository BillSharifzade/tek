"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { adminApi } from "@/lib/admin-api";
import type { AdminDocument } from "@/lib/admin-types";
import { cn } from "@/lib/cn";
import { int } from "@/lib/format";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, type Column } from "@/components/account/DataTable";
import { Card, CardTitle, btnCls, errorMessage, fieldCls } from "@/components/account/shared";
import { DOC_KIND_OPTIONS, NewDocumentForm, docHref, docKindLabel } from "./ProductEditView";
import { ConfirmModal, ErrorLine, SearchField, Spinner, useLoad } from "./shared";
import { useQueryState, useSearchText } from "./useQueryState";

const iconBtn = "inline-flex size-[32px] items-center justify-center rounded-[6px] text-sub transition-colors hover:bg-btn hover:text-black";

function sizeLabel(d: AdminDocument): string {
  if (!d.has_file) return d.url ? "ссылка" : "образец";
  return d.size_kb >= 1024 ? `${(d.size_kb / 1024).toFixed(1).replace(".", ",")} МБ` : `${d.size_kb} КБ`;
}

/** «Документы»: общая библиотека документов товаров — загрузка файлов и ссылок, переименование, удаление. Привязка к товарам — в карточке товара. */
export function DocumentsView() {
  const qs = useQueryState();
  const q = qs.get("q");
  const page = Math.max(1, Number(qs.get("page", "1")) || 1);
  const [text, setText] = useSearchText(qs);
  const list = useLoad(`documents:${q}:${page}`, () => adminApi.documents({ q, page, per_page: 50 }), "Не удалось загрузить документы");
  const [edit, setEdit] = useState<AdminDocument | null>(null);
  const [remove, setRemove] = useState<AdminDocument | null>(null);
  const [busy, setBusy] = useState(false);

  const doRemove = async () => {
    if (!remove) return;
    setBusy(true);
    try {
      await adminApi.deleteDocument(remove.id);
      toast.success("Документ удалён");
      setRemove(null);
      list.reload();
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось удалить документ"));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<AdminDocument>[] = [
    { key: "id", header: "№", className: "w-[60px]", cell: (d) => <span className="tnum text-[#555]">{d.id}</span> },
    {
      key: "title",
      header: "Документ",
      cell: (d) => (
        <span className="block min-w-[220px]">
          <a href={docHref(d)} target="_blank" rel="noopener noreferrer" className="line-clamp-2 font-medium text-black underline decoration-transparent underline-offset-[3px] hover:decoration-black">
            {d.title}
          </a>
          <span className="block truncate text-[13px] leading-[18px] text-[#555]">{d.has_file ? d.file_name : (d.url ?? d.file_name)}</span>
        </span>
      ),
    },
    { key: "kind", header: "Вид", hideBelow: "md", className: "w-[170px]", cell: (d) => docKindLabel(d.kind) },
    { key: "size", header: "Файл", hideBelow: "md", className: "w-[90px]", cell: (d) => <span className="whitespace-nowrap tnum">{sizeLabel(d)}</span> },
    { key: "products", header: "Товаров", align: "right", className: "w-[90px]", cell: (d) => <span className="tnum">{int(d.products ?? 0)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "w-[84px]",
      cell: (d) => (
        <span className="inline-flex gap-[4px]">
          <button type="button" className={iconBtn} onClick={() => setEdit(d)} aria-label={`Изменить: ${d.title}`} title="Изменить">
            <Pencil className="size-4" />
          </button>
          <button type="button" className={iconBtn} onClick={() => setRemove(d)} aria-label={`Удалить: ${d.title}`} title="Удалить">
            <Trash2 className="size-4" />
          </button>
        </span>
      ),
    },
  ];

  const data = list.data;
  return (
    <div className="flex flex-col gap-[16px] lg:gap-[27px]">
      <Card className="min-h-[300px]">
        <CardTitle right={list.loading && data ? <Spinner /> : data ? <span className="text-[15px] leading-[20px] text-[#555] tnum">Всего: {data.total}</span> : null}>Документы товаров</CardTitle>
        <SearchField value={text} onChange={setText} placeholder="Название или имя файла" className="mt-[20px] sm:max-w-[360px]" />
        <ErrorLine error={list.error} className="mt-[20px]" />
        <div className="mt-[24px]">
          {data === null ? (
            list.error ? null : <Skeleton className="h-[240px] rounded-[7px]" />
          ) : (
            <DataTable columns={columns} rows={data.items} rowKey={(d) => String(d.id)} dense empty={q ? "Ничего не нашли" : "Документов пока нет"} />
          )}
        </div>
        {data ? <Pagination page={data.page} pages={data.pages} hrefFor={(p) => qs.hrefFor({ page: p })} className="mt-[24px]" /> : null}
        <p className="mt-[16px] text-[13px] leading-[18px] text-sub">Документ привязывается к товарам в карточке товара («Товары» → карточка) или столбцом «Документы» при импорте (#номер документа).</p>
      </Card>
      <Card>
        <NewDocumentForm
          className="max-w-[520px]"
          onCreated={(d) => {
            toast.success(`Документ #${d.id} добавлен в библиотеку`);
            list.reload();
          }}
        />
      </Card>

      {edit ? (
        <EditDocumentModal
          key={edit.id}
          doc={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            list.reload();
          }}
        />
      ) : null}
      <ConfirmModal open={remove !== null} title="Удалить документ?" confirmLabel="Удалить" danger busy={busy} onConfirm={doRemove} onClose={() => setRemove(null)}>
        «{remove?.title}» пропадёт у всех товаров ({int(remove?.products ?? 0)}), загруженный файл будет удалён.
      </ConfirmModal>
    </div>
  );
}

function EditDocumentModal({ doc, onClose, onSaved }: { doc: AdminDocument; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(doc.title);
  const [kind, setKind] = useState(doc.kind);
  const [url, setUrl] = useState(doc.url ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError("Укажите название");
    setBusy(true);
    try {
      await adminApi.updateDocument(doc.id, { title: title.trim(), kind, ...(!doc.has_file && url.trim() ? { url: url.trim() } : {}) });
      toast.success("Документ сохранён");
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "Не удалось сохранить документ"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Документ #${doc.id}`} size="md">
      <form onSubmit={save} className="flex flex-col gap-[10px]">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Название" maxLength={300} className={fieldCls} />
        <Select options={DOC_KIND_OPTIONS} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Вид документа" />
        {!doc.has_file ? <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Ссылка https://…" aria-label="Ссылка" className={fieldCls} /> : null}
        <ErrorLine error={error} />
        <div className={cn("mt-[10px] flex justify-end gap-[10px]")}>
          <Button variant="outline" className={btnCls} onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button type="submit" className={btnCls} loading={busy}>
            Сохранить
          </Button>
        </div>
      </form>
    </Modal>
  );
}
