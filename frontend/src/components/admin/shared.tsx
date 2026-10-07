"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { date } from "@/lib/format";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ErrorLine, btnCls, errorMessage, fieldCls } from "@/components/account/shared";

/*
 * Общие детали панели управления. Макета для админки нет — всё собрано из языка личного кабинета
 * (карточки, поля 35px, таблицы ЛК, кнопки 34px), см. components/account/shared.tsx.
 */

export const isStaff = (u: Pick<User, "role"> | null | undefined) => u?.role === "manager" || u?.role === "admin";
export const isAdmin = (u: Pick<User, "role"> | null | undefined) => u?.role === "admin";

// ---------- загрузка данных ----------

interface LoadResult<T> {
  key: string;
  data: T | null;
  error: string | null;
  status: number;
}

export interface Loaded<T> {
  /** последние успешно загруженные данные (при смене фильтра остаются на экране, пока идёт запрос) */
  data: T | null;
  /** ошибка последнего запроса по текущему ключу */
  error: string | null;
  /** HTTP-статус ошибки (404 — раздел ещё не поддерживается сервером) */
  status: number;
  loading: boolean;
  reload: () => void;
  /** локально поправить загруженные данные (после успешного сохранения) */
  mutate: (fn: (d: T) => T) => void;
}

/**
 * Загрузка по ключу: запрос уходит при смене `key` (null — не загружать) и по `reload()`.
 * setState вызывается только из колбэков промиса — как в *View.tsx личного кабинета (react-hooks v7).
 */
export function useLoad<T>(key: string | null, load: () => Promise<T>, fallbackError = "Не удалось загрузить данные"): Loaded<T> {
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const [nonce, setNonce] = useState(0);
  const [res, setRes] = useState<LoadResult<T> | null>(null);
  const reqKey = key === null ? null : `${key}#${nonce}`;

  useEffect(() => {
    if (reqKey === null) return;
    let cancelled = false;
    loadRef.current().then(
      (data) => {
        if (!cancelled) setRes({ key: reqKey, data, error: null, status: 200 });
      },
      (e: unknown) => {
        if (!cancelled) setRes((prev) => ({ key: reqKey, data: prev?.data ?? null, error: loadErrorMessage(e, fallbackError), status: e instanceof ApiError ? e.status : 0 }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [reqKey, fallbackError]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const mutate = useCallback((fn: (d: T) => T) => setRes((r) => (r && r.data !== null ? { ...r, data: fn(r.data) } : r)), []);
  const loading = reqKey !== null && res?.key !== reqKey;
  const current = res?.key === reqKey;
  return { data: res?.data ?? null, error: current ? (res?.error ?? null) : null, status: current ? (res?.status ?? 0) : 0, loading, reload, mutate };
}

/** Сообщение об ошибке загрузки: 404 у списка означает, что сервер ещё не умеет этот раздел. */
export function loadErrorMessage(e: unknown, fallback = "Не удалось загрузить данные"): string {
  if (e instanceof ApiError && ((e.status === 404 && (e.message === "Не найдено" || e.code === "not_found")) || e.status === 405)) {
    return `Раздел пока недоступен: сервер не поддерживает этот запрос (${e.status}). Обновите страницу позже.`;
  }
  if (e instanceof ApiError && e.status === 403) return e.message && e.message !== "Доступ запрещён" ? e.message : "Недостаточно прав для этого раздела";
  if (e instanceof ApiError && e.status === 0) return fallback;
  return errorMessage(e, fallback);
}

export { ErrorLine };

// ---------- подписи ----------

export const ROLE_LABEL: Record<string, string> = { customer: "Клиент", manager: "Менеджер", admin: "Администратор" };
export const USER_STATUS_LABEL: Record<string, string> = { pending: "Ожидает одобрения", approved: "Активен", blocked: "Заблокирован" };
export const CUSTOMER_TYPE_LABEL: Record<string, string> = { retail: "Розничный", legal: "Юрлицо", electrician: "Электромонтажник", purchaser: "Закупщик" };
export const ORDER_STATUS_LABEL: Record<string, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  processing: "В обработке",
  shipped: "Отгружен",
  delivered: "Доставлен",
  cancelled: "Отменён",
};
export const PAYMENT_STATUS_LABEL: Record<string, string> = { pending: "Ожидает оплаты", paid: "Оплачен", invoice_issued: "Выставлен счёт", failed: "Ошибка оплаты", partial: "Частично оплачен" };
export const PAYMENT_METHOD_LABEL: Record<string, string> = { alif: "Алиф Банк", dc: "Душанбе Сити Банк", cash: "Наличными", invoice: "По счёту" };
export const DELIVERY_LABEL: Record<string, string> = { courier: "Доставка", pickup: "Самовывоз" };
export const LEAD_STATUS_LABEL: Record<string, string> = { new: "Новая", in_progress: "В работе", done: "Завершена" };
export const LEAD_KIND_LABEL: Record<string, string> = { service: "Услуга", feedback: "Обратная связь", question: "Вопрос", project: "Проект", consultation: "Консультация" };
export const OUTBOX_STATUS_LABEL: Record<string, string> = { pending: "В очереди", sent: "Отправлено", failed: "Ошибка" };
export const INTEGRATION_LABEL: Record<string, string> = { crm: "CRM", onec: "1С (склад)", email: "E-mail", reservation: "Резерв на складе" };
export const SYNC_STATUS_LABEL: Record<string, string> = { pending: "в очереди", sent: "отправлено", sent_mock: "отправлено (тест)", failed: "ошибка" };

export const label = (map: Record<string, string>, key: string | null | undefined) => (key ? (map[key] ?? key) : "—");

/** Переходы статусов заказа (как на сервере): отмена — до доставки. */
export const ORDER_TRANSITIONS: Record<string, string[]> = {
  new: ["confirmed", "processing", "shipped", "cancelled"],
  confirmed: ["processing", "shipped", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
};

export const ORDER_ACTION_LABEL: Record<string, string> = {
  confirmed: "Подтвердить",
  processing: "В обработку",
  shipped: "Отгружен",
  delivered: "Доставлен",
  cancelled: "Отменить заказ",
};

export function fullName(p: { first_name?: string | null; last_name?: string | null }): string {
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
}

/** ISO → «07.10.2026 14:05» */
export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${date(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ---------- элементы ----------

type Tone = "neutral" | "yellow" | "blue" | "green" | "red";
const TONE_CLS: Record<Tone, string> = {
  neutral: "bg-btn text-g333",
  yellow: "bg-brand-light text-black",
  blue: "bg-hit-bg text-hit",
  green: "bg-new-bg text-new",
  red: "bg-sale-bg text-sale-text",
};

/** Плашка-статус в палитре StatusBadge (r3, Medium 12). */
export function Tag({ tone = "neutral", children, className, title }: { tone?: Tone; children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex h-[20px] items-center whitespace-nowrap rounded-[3px] px-[7px] text-[12px] font-medium leading-[12px]", TONE_CLS[tone], className)}>
      {children}
    </span>
  );
}

export const USER_STATUS_TONE: Record<string, Tone> = { pending: "yellow", approved: "green", blocked: "red" };
export const LEAD_STATUS_TONE: Record<string, Tone> = { new: "blue", in_progress: "yellow", done: "green" };
export const OUTBOX_STATUS_TONE: Record<string, Tone> = { pending: "yellow", sent: "green", failed: "red" };

export interface ChipItem<K extends string> {
  key: K;
  label: string;
  count?: number;
}

/** Фильтр-чипы (как сегмент-кнопки сортировки каталога и пагинация: h32, r5, #EEF0F2 → текущий #FFCC33). */
export function Chips<K extends string>({ items, value, onChange, className, label: aria }: { items: ChipItem<K>[]; value: K; onChange: (k: K) => void; className?: string; label?: string }) {
  return (
    <div role="group" aria-label={aria} className={cn("flex flex-wrap gap-[6px]", className)}>
      {items.map((c) => (
        <button
          key={c.key}
          type="button"
          aria-pressed={c.key === value}
          onClick={() => onChange(c.key)}
          className={cn(
            "inline-flex h-[32px] items-center gap-[6px] whitespace-nowrap rounded-[5px] px-[12px] text-[14px] leading-[16px] text-black transition-colors",
            c.key === value ? "bg-brand font-medium" : "bg-btn hover:bg-btn-hover",
          )}
        >
          {c.label}
          {c.count !== undefined ? <span className={cn("tnum", c.key === value ? "text-black" : "text-sub")}>{c.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Поле поиска в языке ЛК: 35px, рамка #E5E5E5, r7, лупа слева. */
export function SearchField({ value, onChange, placeholder, className, label: aria }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string; label?: string }) {
  return (
    <div className={cn("min-w-[220px]", className)}>
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={aria ?? placeholder}
        left={<Search className="size-[16px]" aria-hidden />}
        className={cn(fieldCls, "pl-[34px]")}
      />
    </div>
  );
}

/** Модалка подтверждения действия (жёлтая шапка ui/Modal). */
export function ConfirmModal({
  open,
  title,
  children,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={() => (busy ? undefined : onClose())}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-[10px]">
          <Button variant="outline" className={btnCls} onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button variant={danger ? "danger" : "primary"} className={btnCls} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="text-[14px] leading-[20px]">{children}</div>
    </Modal>
  );
}

/** Подпись + значение в карточках-реквизитах (15/20: подпись #555, значение 600 #000). */
export function InfoRow({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-x-[16px] gap-y-[2px] sm:grid-cols-[168px_1fr]", className)}>
      <dt className="text-[15px] leading-[23px] text-[#555]">{title}</dt>
      <dd className="min-w-0 break-words text-[15px] font-semibold leading-[23px] text-black">{children}</dd>
    </div>
  );
}

/** Числовое поле процента/суммы: принимает «12,5» и «12.5». */
export function parseNum(v: string): number | null {
  const s = v.replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Маленький индикатор загрузки рядом с фильтрами. */
export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block size-4 animate-spin rounded-full border-2 border-line-3 border-t-outline-hover", className)} aria-label="Загрузка" />;
}
