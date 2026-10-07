"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { adminApi } from "@/lib/admin-api";
import type { Coupon, CouponInput, CouponKind } from "@/lib/admin-types";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { date, int, isoDate, money } from "@/lib/format";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Checkbox";
import { Field, Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, type Column } from "@/components/account/DataTable";
import { Card, CardTitle, btnCls, errorMessage, fieldCls } from "@/components/account/shared";
import { ConfirmModal, ErrorLine, Spinner, Tag, parseNum, useLoad } from "./shared";

const KIND_LABEL: Record<CouponKind, string> = { percent: "Процент от суммы", fixed: "Фиксированная сумма" };

const couponValue = (c: Pick<Coupon, "kind" | "value">) => (c.kind === "percent" ? `${c.value}%` : money(c.value));
const expired = (c: Coupon) => Boolean(c.expires_at && new Date(c.expires_at).getTime() < Date.now());

/** Полное тело для PUT: сервер может ожидать все поля купона. */
const toInput = (c: Coupon, patch: Partial<CouponInput> = {}): CouponInput => ({
  kind: c.kind,
  value: c.value,
  min_total: c.min_total ?? 0,
  active: c.active,
  expires_at: c.expires_at,
  usage_limit: c.usage_limit,
  ...patch,
});

/** «Купоны»: промокоды корзины. Создание и правка — в модалке, удаление — с подтверждением. */
export function CouponsView() {
  const list = useLoad("coupons", () => adminApi.coupons(), "Не удалось загрузить купоны");
  const [edit, setEdit] = useState<Coupon | "new" | null>(null);
  const [toDelete, setToDelete] = useState<Coupon | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const toggleActive = async (c: Coupon, active: boolean) => {
    setBusy(c.code);
    try {
      const r = await adminApi.updateCoupon(c.code, toInput(c, { active }));
      list.mutate((d) => d.map((x) => (x.code === c.code ? (r && typeof r === "object" && "code" in r ? r : { ...x, active }) : x)));
      toast.success(active ? `Купон ${c.code} включён` : `Купон ${c.code} выключен`);
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось сохранить купон"));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setBusy(`del:${toDelete.code}`);
    try {
      await adminApi.deleteCoupon(toDelete.code);
      list.mutate((d) => d.filter((x) => x.code !== toDelete.code));
      toast.info(`Купон ${toDelete.code} удалён`);
      setToDelete(null);
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось удалить купон"));
    } finally {
      setBusy(null);
    }
  };

  const columns: Column<Coupon>[] = [
    { key: "code", header: "Код", cell: (c) => <span className="font-mono text-[15px] font-semibold tracking-[0.02em]">{c.code}</span> },
    { key: "value", header: "Скидка", className: "w-[130px]", cell: (c) => <span className="font-medium tnum">{couponValue(c)}</span> },
    { key: "min", header: "От суммы", hideBelow: "md", className: "w-[130px]", cell: (c) => <span className="tnum">{c.min_total ? money(c.min_total) : "—"}</span> },
    {
      key: "expires",
      header: "Действует до",
      className: "w-[130px]",
      cell: (c) => (c.expires_at ? <span className={cn("tnum", expired(c) && "text-[#D13B3E]")}>{date(c.expires_at)}</span> : <span className="text-muted">бессрочно</span>),
    },
    {
      key: "used",
      header: "Использован",
      hideBelow: "md",
      className: "w-[120px]",
      cell: (c) => (
        <span className="whitespace-nowrap tnum" title={c.usage_limit ? undefined : "Без лимита"}>
          {int(c.used_count)} <span className="text-muted">из</span> {c.usage_limit ? int(c.usage_limit) : <span className="text-muted">∞</span>}
        </span>
      ),
    },
    {
      key: "active",
      header: "Активен",
      className: "w-[150px]",
      cell: (c) => (
        <span className="flex items-center gap-[8px]">
          <Toggle checked={c.active} disabled={busy === c.code} onChange={(v) => toggleActive(c, v)} label={<span className="sr-only">Купон {c.code} активен</span>} className="justify-start gap-0" />
          {expired(c) ? <Tag tone="red">истёк</Tag> : c.usage_limit && c.used_count >= c.usage_limit ? <Tag tone="red">исчерпан</Tag> : null}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "w-[92px]",
      cell: (c) => (
        <span className="inline-flex gap-[4px]">
          <button type="button" onClick={() => setEdit(c)} className="inline-flex size-[32px] items-center justify-center rounded-[6px] text-sub transition-colors hover:bg-btn hover:text-black" aria-label={`Изменить купон ${c.code}`} title="Изменить">
            <Pencil className="size-4" />
          </button>
          <button type="button" onClick={() => setToDelete(c)} className="inline-flex size-[32px] items-center justify-center rounded-[6px] text-sub transition-colors hover:bg-sale-bg hover:text-sale-text" aria-label={`Удалить купон ${c.code}`} title="Удалить">
            <Trash2 className="size-4" />
          </button>
        </span>
      ),
    },
  ];

  return (
    <Card className="min-h-[347px]">
      <CardTitle
        right={
          <span className="flex items-center gap-[12px]">
            {list.loading && list.data ? <Spinner /> : null}
            <Button className={btnCls} icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdit("new")} disabled={list.data === null}>
              Новый купон
            </Button>
          </span>
        }
      >
        Купоны
      </CardTitle>
      <ErrorLine error={list.error} className="mt-[20px]" />
      <div className="mt-[28px]">
        {list.data === null ? (
          list.error ? null : <Skeleton className="h-[200px] rounded-[7px]" />
        ) : (
          <DataTable columns={columns} rows={list.data} rowKey={(c) => c.code} empty="Купонов пока нет — создайте первый" />
        )}
      </div>
      <p className="mt-[16px] text-[13px] leading-[18px] text-sub">Покупатель вводит код купона в корзине. Выключенный, истёкший или исчерпанный купон корзина не примет.</p>

      {edit ? (
        <CouponModal
          key={edit === "new" ? "new" : edit.code}
          coupon={edit === "new" ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={(c) => {
            list.mutate((d) => (d.some((x) => x.code === c.code) ? d.map((x) => (x.code === c.code ? c : x)) : [c, ...d]));
            setEdit(null);
          }}
        />
      ) : null}

      <ConfirmModal open={toDelete !== null} title="Удалить купон?" confirmLabel="Удалить" danger busy={busy?.startsWith("del:")} onConfirm={remove} onClose={() => setToDelete(null)}>
        Купон <b className="font-mono">{toDelete?.code}</b> перестанет работать в корзине. Уже оформленные заказы со скидкой по нему не изменятся.
      </ConfirmModal>
    </Card>
  );
}

function CouponModal({ coupon, onClose, onSaved }: { coupon: Coupon | null; onClose: () => void; onSaved: (c: Coupon) => void }) {
  const [code, setCode] = useState(coupon?.code ?? "");
  const [kind, setKind] = useState<CouponKind>(coupon?.kind ?? "percent");
  const [value, setValue] = useState(coupon ? String(coupon.value) : "");
  const [minTotal, setMinTotal] = useState(coupon?.min_total ? String(coupon.min_total) : "");
  const [expires, setExpires] = useState(coupon?.expires_at ? isoDate(new Date(coupon.expires_at)) : "");
  const [limit, setLimit] = useState(coupon?.usage_limit ? String(coupon.usage_limit) : "");
  const [active, setActive] = useState(coupon?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const c = code.trim().toUpperCase();
    const v = parseNum(value);
    const min = minTotal.trim() ? parseNum(minTotal) : 0;
    const lim = limit.trim() ? parseNum(limit) : null;
    if (!coupon && !/^[A-Z0-9_-]{3,32}$/.test(c)) return setError("Код — 3–32 символа: латинские буквы, цифры, «-» и «_»");
    if (v === null || v <= 0 || (kind === "percent" && v > 100)) return setError(kind === "percent" ? "Процент — от 0 до 100" : "Укажите сумму скидки больше 0");
    if (min === null || min < 0) return setError("Минимальная сумма заказа — число не меньше 0");
    if (lim !== null && (!Number.isInteger(lim) || lim < 1)) return setError("Лимит использований — целое число от 1 (или оставьте пустым)");
    const body: CouponInput = {
      kind,
      value: v,
      min_total: min,
      active,
      // дата без времени — сервер считает срок до конца дня по времени Душанбе
      expires_at: expires || null,
      usage_limit: lim,
    };
    setBusy(true);
    try {
      const r = coupon ? await adminApi.updateCoupon(coupon.code, body) : await adminApi.createCoupon({ ...body, code: c });
      const saved: Coupon = r && typeof r === "object" && "code" in r ? r : { code: coupon?.code ?? c, used_count: coupon?.used_count ?? 0, ...body, min_total: min, expires_at: body.expires_at ?? null, usage_limit: lim, active };
      toast.success(coupon ? `Купон ${saved.code} сохранён` : `Купон ${saved.code} создан`);
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.code === "coupon_exists") setError(`Купон с кодом ${c} уже есть`);
      else setError(errorMessage(err, "Не удалось сохранить купон"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => (busy ? undefined : onClose())}
      title={coupon ? `Купон ${coupon.code}` : "Новый купон"}
      footer={
        <div className="flex justify-end gap-[10px]">
          <Button variant="outline" className={btnCls} onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button className={btnCls} loading={busy} onClick={() => submit()}>
            {coupon ? "Сохранить" : "Создать купон"}
          </Button>
        </div>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
        <Field label="Код" required htmlFor="cp-code" hint={coupon ? "Код купона не меняется" : "Например, SALE10"} className="sm:col-span-2">
          <Input id="cp-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} disabled={Boolean(coupon)} maxLength={32} autoFocus={!coupon} className={cn(fieldCls, "font-mono uppercase")} />
        </Field>
        <Field label="Тип скидки" htmlFor="cp-kind">
          <Select
            id="cp-kind"
            options={(Object.keys(KIND_LABEL) as CouponKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
            value={kind}
            onChange={(e) => setKind(e.target.value as CouponKind)}
          />
        </Field>
        <Field label={kind === "percent" ? "Скидка, %" : "Скидка, с."} required htmlFor="cp-value">
          <Input id="cp-value" value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className={cn(fieldCls, "tnum")} />
        </Field>
        <Field label="Минимальная сумма заказа, с." htmlFor="cp-min" hint="Пусто — без ограничения">
          <Input id="cp-min" value={minTotal} onChange={(e) => setMinTotal(e.target.value)} inputMode="decimal" className={cn(fieldCls, "tnum")} />
        </Field>
        <Field label="Лимит использований" htmlFor="cp-limit" hint={coupon ? `Использован: ${coupon.used_count}` : "Пусто — без лимита"}>
          <Input id="cp-limit" value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="numeric" className={cn(fieldCls, "tnum")} />
        </Field>
        <Field label="Действует до (включительно)" htmlFor="cp-exp" hint="Пусто — бессрочно">
          <Input id="cp-exp" type="date" value={expires} min={coupon ? undefined : isoDate(new Date())} onChange={(e) => setExpires(e.target.value)} className={cn(fieldCls, "tnum")} />
        </Field>
        <div className="flex items-end pb-[22px]">
          <Toggle checked={active} onChange={setActive} label="Купон активен" className="justify-start gap-[12px]" />
        </div>
        <ErrorLine error={error} className="sm:col-span-2" />
        <button type="submit" hidden aria-hidden />
      </form>
    </Modal>
  );
}
