"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { adminApi } from "@/lib/admin-api";
import type { AdminStore, StoreInput } from "@/lib/admin-types";
import { int } from "@/lib/format";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, type Column } from "@/components/account/DataTable";
import { Card, CardTitle, btnCls, errorMessage, fieldCls } from "@/components/account/shared";
import { FieldLabel } from "./ContentFields";
import { ConfirmModal, ErrorLine, parseNum, useLoad } from "./shared";

const iconBtn = "inline-flex size-[32px] items-center justify-center rounded-[6px] text-sub transition-colors hover:bg-btn hover:text-black";

/**
 * «Магазины и склады»: адреса, телефоны и режим работы (контакты, самовывоз в чекауте, остатки на странице товара),
 * координаты для карты; код склада — заголовок «Остаток <код>» в импорте.
 */
export function StoresAdminView() {
  const list = useLoad("admin-stores", () => adminApi.adminStores(), "Не удалось загрузить склады");
  const [edit, setEdit] = useState<AdminStore | "new" | null>(null);
  const [remove, setRemove] = useState<AdminStore | null>(null);
  const [busy, setBusy] = useState(false);

  const doRemove = async () => {
    if (!remove) return;
    setBusy(true);
    try {
      await adminApi.deleteStore(remove.id);
      toast.success("Склад удалён");
      setRemove(null);
      list.reload();
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось удалить склад"));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<AdminStore>[] = [
    { key: "code", header: "Код", className: "w-[110px]", cell: (s) => <span className="tnum">{s.code}</span> },
    {
      key: "name",
      header: "Склад / магазин",
      cell: (s) => (
        <span className="block min-w-[220px]">
          <span className="block font-medium">
            {s.city}, {s.name}
          </span>
          <span className="block text-[13px] leading-[18px] text-[#555]">{[s.address, s.phone, s.hours].filter(Boolean).join(" · ")}</span>
        </span>
      ),
    },
    { key: "products", header: "Товаров в наличии", align: "right", hideBelow: "md", className: "w-[150px]", cell: (s) => <span className="tnum">{int(s.products ?? 0)}</span> },
    { key: "stock", header: "Остаток, ед.", align: "right", hideBelow: "lg", className: "w-[120px]", cell: (s) => <span className="tnum">{int(Math.round(Number(s.stock_total ?? 0)))}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "w-[84px]",
      cell: (s) => (
        <span className="inline-flex gap-[4px]">
          <button type="button" className={iconBtn} onClick={() => setEdit(s)} aria-label={`Изменить: ${s.name}`} title="Изменить">
            <Pencil className="size-4" />
          </button>
          <button type="button" className={iconBtn} onClick={() => setRemove(s)} aria-label={`Удалить: ${s.name}`} title="Удалить">
            <Trash2 className="size-4" />
          </button>
        </span>
      ),
    },
  ];

  return (
    <Card className="min-h-[300px]">
      <CardTitle
        right={
          <Button className={btnCls} icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdit("new")}>
            Добавить склад
          </Button>
        }
      >
        Магазины и склады
      </CardTitle>
      <ErrorLine error={list.error} className="mt-[20px]" />
      <div className="mt-[24px]">
        {list.data === null ? list.error ? null : <Skeleton className="h-[200px] rounded-[7px]" /> : <DataTable columns={columns} rows={list.data} rowKey={(s) => String(s.id)} dense empty="Складов пока нет" />}
      </div>
      <p className="mt-[16px] text-[13px] leading-[18px] text-sub">
        Склады показываются в контактах, в самовывозе при оформлении заказа и в наличии на странице товара. Удалить можно склад без остатков и заказов.
      </p>
      {edit ? (
        <StoreModal
          key={edit === "new" ? "new" : edit.id}
          store={edit === "new" ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            list.reload();
          }}
        />
      ) : null}
      <ConfirmModal open={remove !== null} title="Удалить склад?" confirmLabel="Удалить" danger busy={busy} onConfirm={doRemove} onClose={() => setRemove(null)}>
        {remove?.city}, {remove?.name} пропадёт с сайта, из самовывоза и из импорта.
      </ConfirmModal>
    </Card>
  );
}

function StoreModal({ store, onClose, onSaved }: { store: AdminStore | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    code: store?.code ?? "",
    city: store?.city ?? "",
    name: store?.name ?? "",
    address: store?.address ?? "",
    phone: store?.phone ?? "",
    hours: store?.hours ?? "",
    delivery_hint: store?.delivery_hint ?? "сегодня",
    lat: store?.lat != null ? String(store.lat) : "",
    lon: store?.lon != null ? String(store.lon) : "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const lat = f.lat.trim() ? parseNum(f.lat) : null;
    const lon = f.lon.trim() ? parseNum(f.lon) : null;
    if ((f.lat.trim() && lat === null) || (f.lon.trim() && lon === null) || (lat === null) !== (lon === null)) return setError("Координаты — два числа (широта и долгота) или оба поля пустые");
    const input: StoreInput = { ...f, code: f.code.trim().toLowerCase(), phone: f.phone.trim() || null, hours: f.hours.trim() || null, lat, lon };
    setBusy(true);
    try {
      if (store) await adminApi.updateStore(store.id, { ...input, sort: store.sort });
      else await adminApi.createStore(input);
      toast.success(store ? "Склад сохранён" : "Склад добавлен");
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "Не удалось сохранить склад"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={store ? `${store.city}, ${store.name}` : "Новый склад"} size="md">
      <form onSubmit={save} className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
        <FieldLabel label="Код" htmlFor="st-code" hint="Латиница: «Остаток <код>» в импорте">
          <Input id="st-code" value={f.code} onChange={set("code")} maxLength={40} placeholder="dushanbe" className={fieldCls} />
        </FieldLabel>
        <FieldLabel label="Город" htmlFor="st-city">
          <Input id="st-city" value={f.city} onChange={set("city")} maxLength={100} className={fieldCls} />
        </FieldLabel>
        <FieldLabel label="Название" htmlFor="st-name" className="sm:col-span-2">
          <Input id="st-name" value={f.name} onChange={set("name")} maxLength={150} placeholder="Центральный склад" className={fieldCls} />
        </FieldLabel>
        <FieldLabel label="Адрес" htmlFor="st-address" className="sm:col-span-2">
          <Input id="st-address" value={f.address} onChange={set("address")} maxLength={300} className={fieldCls} />
        </FieldLabel>
        <FieldLabel label="Телефон" htmlFor="st-phone">
          <Input id="st-phone" value={f.phone} onChange={set("phone")} maxLength={60} placeholder="+992" className={fieldCls} />
        </FieldLabel>
        <FieldLabel label="Режим работы" htmlFor="st-hours">
          <Input id="st-hours" value={f.hours} onChange={set("hours")} maxLength={120} placeholder="Пн–Сб 9:00–17:00" className={fieldCls} />
        </FieldLabel>
        <FieldLabel label="Широта" htmlFor="st-lat" hint="Для карты, например 38.549998">
          <Input id="st-lat" value={f.lat} onChange={set("lat")} inputMode="decimal" className={fieldCls} />
        </FieldLabel>
        <FieldLabel label="Долгота" htmlFor="st-lon" hint="Например 68.735072">
          <Input id="st-lon" value={f.lon} onChange={set("lon")} inputMode="decimal" className={fieldCls} />
        </FieldLabel>
        <FieldLabel label="Когда можно забрать" htmlFor="st-hint" hint="Подпись в наличии на странице товара: «сегодня», «завтра»">
          <Input id="st-hint" value={f.delivery_hint} onChange={set("delivery_hint")} maxLength={40} className={fieldCls} />
        </FieldLabel>
        <div className="sm:col-span-2">
          <ErrorLine error={error} />
          <div className="mt-[6px] flex justify-end gap-[10px]">
            <Button variant="outline" className={btnCls} onClick={onClose} disabled={busy}>
              Отмена
            </Button>
            <Button type="submit" className={btnCls} loading={busy}>
              Сохранить
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
