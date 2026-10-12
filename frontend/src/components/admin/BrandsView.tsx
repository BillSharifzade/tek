"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { adminApi } from "@/lib/admin-api";
import type { AdminBrand } from "@/lib/admin-types";
import { int } from "@/lib/format";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, type Column } from "@/components/account/DataTable";
import { Card, CardTitle, btnCls, errorMessage, fieldCls, labelCls } from "@/components/account/shared";
import { CountryList } from "./ProductEditView";
import { ErrorLine, SearchField, useLoad } from "./shared";
import { useQueryState, useSearchText } from "./useQueryState";

const iconBtn = "inline-flex size-[32px] items-center justify-center rounded-[6px] text-sub transition-colors hover:bg-btn hover:text-black";

/** «Бренды»: страна бренда и страна производства (флаги в карточке товара), название, описание. Новые бренды создаёт импорт. */
export function BrandsView() {
  const qs = useQueryState();
  const q = qs.get("q");
  const [text, setText] = useSearchText(qs);
  const list = useLoad("brands", () => adminApi.brands(), "Не удалось загрузить бренды");
  const [edit, setEdit] = useState<AdminBrand | null>(null);
  const needle = q.trim().toLowerCase();
  const rows = (list.data ?? []).filter((b) => !needle || b.name.toLowerCase().includes(needle) || b.slug.includes(needle));

  const columns: Column<AdminBrand>[] = [
    { key: "name", header: "Бренд", cell: (b) => <span className="font-medium">{b.name}</span> },
    { key: "country_brand", header: "Страна бренда", cell: (b) => b.country_brand ?? <span className="text-muted">—</span> },
    { key: "country_origin", header: "Страна производства", hideBelow: "md", cell: (b) => b.country_origin ?? <span className="text-muted">—</span> },
    { key: "products", header: "Товаров", align: "right", className: "w-[90px]", cell: (b) => <span className="tnum">{int(b.products ?? 0)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "w-[52px]",
      cell: (b) => (
        <button type="button" className={iconBtn} onClick={() => setEdit(b)} aria-label={`Изменить: ${b.name}`} title="Изменить">
          <Pencil className="size-4" />
        </button>
      ),
    },
  ];

  return (
    <Card className="min-h-[300px]">
      <CardTitle>Бренды</CardTitle>
      <SearchField value={text} onChange={setText} placeholder="Название бренда" className="mt-[20px] sm:max-w-[360px]" />
      <ErrorLine error={list.error} className="mt-[20px]" />
      <div className="mt-[24px]">
        {list.data === null ? (
          list.error ? null : <Skeleton className="h-[240px] rounded-[7px]" />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(b) => String(b.id)} dense onRowClick={(b) => setEdit(b)} empty={q ? "Ничего не нашли" : "Брендов пока нет"} />
        )}
      </div>
      <p className="mt-[16px] text-[13px] leading-[18px] text-sub">
        Страны показываются с флагом в карточке товара («страна бренда», «страна производства»). Если товар производится в другой стране, укажите её в карточке товара. Новые бренды создаёт импорт каталога.
      </p>
      {edit ? (
        <BrandModal
          key={edit.id}
          brand={edit}
          onClose={() => setEdit(null)}
          onSaved={(b) => {
            list.mutate((d) => d.map((x) => (x.id === b.id ? b : x)));
            setEdit(null);
          }}
        />
      ) : null}
    </Card>
  );
}

function BrandModal({ brand, onClose, onSaved }: { brand: AdminBrand; onClose: () => void; onSaved: (b: AdminBrand) => void }) {
  const [name, setName] = useState(brand.name);
  const [countryBrand, setCountryBrand] = useState(brand.country_brand ?? "");
  const [countryOrigin, setCountryOrigin] = useState(brand.country_origin ?? "");
  const [description, setDescription] = useState(brand.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Укажите название");
    setBusy(true);
    try {
      const b = await adminApi.updateBrand(brand.id, {
        name: name.trim(),
        country_brand: countryBrand.trim() || null,
        country_origin: countryOrigin.trim() || null,
        description: description.trim() || null,
      });
      toast.success("Бренд сохранён");
      onSaved(b);
    } catch (err) {
      setError(errorMessage(err, "Не удалось сохранить бренд"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={brand.name} size="md">
      <form onSubmit={save} className="flex flex-col gap-[12px]">
        <label className={labelCls}>
          Название
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={`${fieldCls} mt-[6px]`} />
        </label>
        <label className={labelCls}>
          Страна бренда
          <Input value={countryBrand} onChange={(e) => setCountryBrand(e.target.value)} list="brand-countries" maxLength={60} className={`${fieldCls} mt-[6px]`} />
        </label>
        <label className={labelCls}>
          Страна производства (для всех товаров бренда)
          <Input value={countryOrigin} onChange={(e) => setCountryOrigin(e.target.value)} list="brand-countries" maxLength={60} className={`${fieldCls} mt-[6px]`} />
        </label>
        <CountryList id="brand-countries" />
        <label className={labelCls}>
          Описание (страница бренда)
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} className={`${fieldCls} mt-[6px] h-auto min-h-[96px] py-[8px]`} />
        </label>
        <ErrorLine error={error} />
        <div className="mt-[6px] flex justify-end gap-[10px]">
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
