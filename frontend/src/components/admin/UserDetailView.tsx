"use client";

import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { adminApi } from "@/lib/admin-api";
import type { AdminManager, AdminUser, AdminUserPatch, PricingRule, Role, UserPricing } from "@/lib/admin-types";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { date, phoneHref } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card, CardTitle, EmptyState, btnCls, errorMessage, fieldCls, labelCls } from "@/components/account/shared";
import { useCatalogRefs } from "./refs";
import {
  CUSTOMER_TYPE_LABEL,
  ConfirmModal,
  ErrorLine,
  InfoRow,
  ROLE_LABEL,
  Tag,
  USER_STATUS_LABEL,
  USER_STATUS_TONE,
  fullName,
  isAdmin,
  label,
  parseNum,
  useLoad,
} from "./shared";

/** Карточки пользователя по id: отдельного GET /admin/users/{id} в контракте нет — при 404/405 ищем в общем списке. */
async function loadUser(id: string): Promise<AdminUser> {
  try {
    return await adminApi.user(id);
  } catch (e) {
    if (!(e instanceof ApiError) || (e.status !== 404 && e.status !== 405)) throw e;
  }
  const all = await adminApi.users();
  const found = all.find((u) => u.id === id);
  if (!found) throw new ApiError(404, "user_not_found", "Пользователь не найден");
  return found;
}

/** Ответ PUT /admin/users/{id} — пользователь; если сервер вернул что-то иное, применяем изменения локально. */
function merged(u: AdminUser, patch: AdminUserPatch, r: unknown): AdminUser {
  if (r && typeof r === "object" && "id" in r && "role" in r) return { ...u, ...(r as AdminUser) };
  return { ...u, ...patch };
}

export function UserDetailView({ id }: { id: string }) {
  const me = useAuth((s) => s.user);
  const admin = isAdmin(me);
  const user = useLoad(`user:${id}`, () => loadUser(id), "Не удалось загрузить пользователя");
  const managers = useLoad("managers", () => adminApi.managers(), "Список менеджеров недоступен");

  if (user.data === null) {
    if (user.error) {
      return (
        <Card>
          <CardTitle>Пользователь</CardTitle>
          {user.status === 404 ? (
            <EmptyState className="mt-[21px]">
              Пользователь не найден.{" "}
              <Link href="/admin/users?tab=all" className="text-black underline underline-offset-[3px]">
                К списку пользователей
              </Link>
            </EmptyState>
          ) : (
            <ErrorLine error={user.error} className="mt-[21px]" />
          )}
        </Card>
      );
    }
    return (
      <div className="flex flex-col gap-[16px] lg:gap-[27px]" aria-busy>
        <Skeleton className="h-[260px] rounded-[7px]" />
        <Skeleton className="h-[200px] rounded-[7px]" />
      </div>
    );
  }

  const u = user.data;
  const self = me?.id === u.id;
  const customer = u.role === "customer";
  // сотрудников (менеджеров и администраторов) меняет только администратор
  const canManage = !self && (admin || customer);
  const update = async (patch: AdminUserPatch, success: string) => {
    try {
      const r = await adminApi.updateUser(u.id, patch);
      user.mutate((prev) => merged(prev, patch, r));
      toast.success(success);
      return true;
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось сохранить изменения"));
      return false;
    }
  };

  return (
    <div className="flex flex-col gap-[16px] lg:gap-[27px]">
      <ProfileCard user={u} self={self} canManage={canManage} update={update} onApproved={() => user.reload()} />
      {customer ? (
        <div className="grid grid-cols-1 gap-[16px] lg:gap-[27px] xl:grid-cols-2">
          <CompanyCard key={`c${u.company_verified}`} user={u} update={update} />
          <ManagerCard key={`m${u.manager_id}`} user={u} managers={managers.data} managersError={managers.error} update={update} />
        </div>
      ) : null}
      {admin ? <RoleCard key={`r${u.role}${u.is_lead_manager}`} user={u} self={self} update={update} /> : null}
      {u.role === "customer" ? <PricingCard user={u} canEdit={!self && (admin || (!!me && u.manager_id === me.id))} onSaved={(p) => user.mutate((prev) => ({ ...prev, discount_pct: p.discount_pct, cashback_pct: p.cashback_pct }))} /> : null}
      <div>
        <ButtonLink href="/admin/users?tab=all" variant="outline" className={btnCls} icon={<ArrowLeft className="size-4" aria-hidden />}>
          К списку пользователей
        </ButtonLink>
      </div>
    </div>
  );
}

type Update = (patch: AdminUserPatch, success: string) => Promise<boolean>;

function ProfileCard({ user: u, self, canManage, update, onApproved }: { user: AdminUser; self: boolean; canManage: boolean; update: Update; onApproved: () => void }) {
  const [busy, setBusy] = useState<"approve" | "block" | "unblock" | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const approve = async () => {
    setBusy("approve");
    try {
      await adminApi.approveUser(u.id);
      toast.success("Аккаунт одобрен, пользователь получил уведомление");
      onApproved();
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось одобрить пользователя"));
    } finally {
      setBusy(null);
    }
  };

  const setStatus = async (status: "approved" | "blocked") => {
    setBusy(status === "blocked" ? "block" : "unblock");
    const ok = await update({ status }, status === "blocked" ? "Пользователь заблокирован" : "Пользователь разблокирован");
    setBusy(null);
    if (ok) setConfirmBlock(false);
  };

  return (
    <Card>
      <CardTitle right={<Tag tone={USER_STATUS_TONE[u.status]}>{label(USER_STATUS_LABEL, u.status)}</Tag>}>{fullName(u) || "Без имени"}</CardTitle>
      <dl className="mt-[21px] flex flex-col gap-[6px]">
        <InfoRow title="E-mail">{u.email ? <a href={`mailto:${u.email}`} className="link-hover">{u.email}</a> : "—"}</InfoRow>
        <InfoRow title="Телефон">{u.phone ? <a href={phoneHref(u.phone)} className="link-hover tnum">{u.phone}</a> : "—"}</InfoRow>
        <InfoRow title="Роль">
          {label(ROLE_LABEL, u.role)}
          {u.is_lead_manager ? <span className="font-normal text-[#555]"> · ведущий менеджер</span> : null}
        </InfoRow>
        {u.role === "customer" ? <InfoRow title="Тип клиента">{label(CUSTOMER_TYPE_LABEL, u.customer_type)}</InfoRow> : null}
        <InfoRow title="Регистрация">
          <span className="tnum">{date(u.created_at)}</span>
        </InfoRow>
      </dl>
      {canManage ? (
        <div className="mt-[24px] flex flex-wrap gap-[10px] border-t border-line pt-[20px]">
          {u.status === "pending" ? (
            <Button className={btnCls} loading={busy === "approve"} onClick={approve}>
              Одобрить регистрацию
            </Button>
          ) : null}
          {u.status === "blocked" ? (
            <Button variant="secondary" className={btnCls} loading={busy === "unblock"} onClick={() => setStatus("approved")}>
              Разблокировать
            </Button>
          ) : (
            <Button variant="danger" className={btnCls} disabled={busy !== null} onClick={() => setConfirmBlock(true)}>
              Заблокировать
            </Button>
          )}
        </div>
      ) : (
        <p className={cn("mt-[20px] border-t border-line pt-[16px]", labelCls)}>
          {self ? "Это ваш аккаунт — статус и роль меняет другой администратор." : "Данные сотрудников меняет администратор."}
        </p>
      )}
      <ConfirmModal
        open={confirmBlock}
        title="Заблокировать пользователя?"
        confirmLabel="Заблокировать"
        danger
        busy={busy === "block"}
        onConfirm={() => setStatus("blocked")}
        onClose={() => setConfirmBlock(false)}
      >
        {fullName(u) || u.email || u.phone} не сможет войти на сайт и оформлять заказы, пока вы его не разблокируете.
      </ConfirmModal>
    </Card>
  );
}

function CompanyCard({ user: u, update }: { user: AdminUser; update: Update }) {
  const [verified, setVerified] = useState(Boolean(u.company_verified));
  const [busy, setBusy] = useState(false);
  const toggle = async (v: boolean) => {
    setBusy(true);
    setVerified(v);
    const ok = await update({ company_verified: v }, v ? "Компания подтверждена — доступна оплата по счёту" : "Подтверждение компании снято");
    if (!ok) setVerified(!v);
    setBusy(false);
  };
  return (
    <Card>
      <CardTitle>Компания</CardTitle>
      {u.company_name ? (
        <>
          <dl className="mt-[21px] flex flex-col gap-[6px]">
            <InfoRow title="Название">{u.company_name}</InfoRow>
            <InfoRow title="ИНН">
              <span className="tnum">{u.company_inn || "—"}</span>
            </InfoRow>
          </dl>
          <Toggle
            className="mt-[20px] border-t border-line pt-[16px]"
            checked={verified}
            disabled={busy}
            onChange={toggle}
            label="Компания проверена"
            description="Открывает оплату по счёту для юридических лиц"
          />
        </>
      ) : (
        <p className={cn("mt-[21px]", labelCls)}>Пользователь не указал данные компании.</p>
      )}
    </Card>
  );
}

function ManagerCard({ user: u, managers, managersError, update }: { user: AdminUser; managers: AdminManager[] | null; managersError: string | null; update: Update }) {
  const [value, setValue] = useState(u.manager_id ?? "");
  const [busy, setBusy] = useState(false);
  const known = managers?.some((m) => m.id === u.manager_id);
  const options = [
    { value: "", label: "Не назначен" },
    ...(u.manager_id && managers && !known ? [{ value: u.manager_id, label: u.manager_name ?? "Текущий менеджер" }] : []),
    ...(managers ?? []).map((m) => ({ value: m.id, label: `${m.name}${m.is_lead_manager ? " (ведущий)" : ""}${m.role === "admin" ? " — админ" : ""}` })),
  ];
  const save = async () => {
    setBusy(true);
    await update({ manager_id: value || null }, value ? "Менеджер назначен" : "Менеджер снят");
    setBusy(false);
  };
  return (
    <Card>
      <CardTitle>Персональный менеджер</CardTitle>
      <p className={cn("mt-[21px]", labelCls)}>
        Сейчас: <span className="font-semibold text-black">{u.manager_name ?? (u.manager_id ? managers?.find((m) => m.id === u.manager_id)?.name ?? "назначен" : "не назначен")}</span>
      </p>
      {managers ? (
        <div className="mt-[16px] flex flex-wrap items-center gap-[10px]">
          <Select options={options} value={value} onChange={(e) => setValue(e.target.value)} aria-label="Менеджер" className="min-w-[220px] flex-1" />
          <Button className={btnCls} loading={busy} disabled={value === (u.manager_id ?? "")} onClick={save}>
            Сохранить
          </Button>
        </div>
      ) : managersError ? (
        <ErrorLine error={managersError} className="mt-[16px]" />
      ) : (
        <Skeleton className="mt-[16px] h-[36px] rounded-[5px]" />
      )}
    </Card>
  );
}

function RoleCard({ user: u, self, update }: { user: AdminUser; self: boolean; update: Update }) {
  const [role, setRole] = useState<Role>(u.role);
  const [lead, setLead] = useState(Boolean(u.is_lead_manager));
  const [busy, setBusy] = useState(false);
  const dirty = role !== u.role || lead !== Boolean(u.is_lead_manager);
  const save = async () => {
    setBusy(true);
    const patch: AdminUserPatch = {};
    if (role !== u.role) patch.role = role;
    if (lead !== Boolean(u.is_lead_manager)) patch.is_lead_manager = lead;
    await update(patch, "Роль сохранена");
    setBusy(false);
  };
  return (
    <Card>
      <CardTitle>Роль и доступ</CardTitle>
      <p className={cn("mt-[21px]", labelCls)}>Менеджеры и администраторы входят в панель управления. Ведущий менеджер получает заказы и заявки без закреплённого менеджера.</p>
      <div className="mt-[16px] flex flex-wrap items-center gap-x-[24px] gap-y-[12px]">
        <Select
          options={[
            { value: "customer", label: ROLE_LABEL.customer },
            { value: "manager", label: ROLE_LABEL.manager },
            { value: "admin", label: ROLE_LABEL.admin },
          ]}
          value={role}
          disabled={self}
          onChange={(e) => setRole(e.target.value as Role)}
          aria-label="Роль"
          className="w-[220px]"
        />
        <Toggle checked={lead} onChange={setLead} disabled={self || role === "customer"} label="Ведущий менеджер" className="justify-start" />
        <Button className={cn(btnCls, "ml-auto")} loading={busy} disabled={!dirty || self} onClick={save}>
          Сохранить
        </Button>
      </div>
    </Card>
  );
}

// ---------- персональные условия ----------

interface RuleRow {
  uid: number;
  /** подписи из сохранённого правила: что сейчас стоит за slug / ID */
  hint: { category?: string | null; brand?: string | null; product?: string | null; productId?: string | null };
  category_slug: string;
  brand_slug: string;
  product_id: string;
  discount: string;
  cashback: string;
}

const toRow = (r: PricingRule, i: number): RuleRow => ({
  uid: i + 1,
  hint: { category: r.category_name, brand: r.brand_name, product: r.product_name ? `${r.product_code ? `${r.product_code} · ` : ""}${r.product_name}` : null, productId: r.product_id },
  category_slug: r.category_slug ?? "",
  brand_slug: r.brand_slug ?? "",
  product_id: r.product_id ?? "",
  discount: String(r.discount_pct ?? 0),
  cashback: String(r.cashback_pct ?? 0),
});
function RuleHint({ text }: { text?: string | null }) {
  return text ? <span className="mt-[3px] block truncate text-[12px] leading-[15px] text-sub" title={text}>{text}</span> : null;
}

const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
const numStr = (n: number | null | undefined) => (n === null || n === undefined ? "0" : String(n).replace(".", ","));

function PricingCard({ user: u, canEdit, onSaved }: { user: AdminUser; canEdit: boolean; onSaved: (p: { discount_pct: number; cashback_pct: number }) => void }) {
  const pricing = useLoad(`pricing:${u.id}`, () => adminApi.pricing(u.id), "Не удалось загрузить правила");
  const refs = useCatalogRefs();

  return (
    <Card>
      <CardTitle>Персональные условия</CardTitle>
      <p className={cn("mt-[21px]", labelCls)}>
        Базовая скидка и кешбэк действуют на весь каталог; правила уточняют их для категории, бренда или конкретного товара (действует самое точное правило). Скидка — 0–90 %, кешбэк — 0–50 %.
      </p>
      {!canEdit ? <p className="mt-[10px] text-[13px] leading-[18px] text-sale-text">Условия клиента меняет его менеджер или администратор.</p> : null}
      {pricing.data === null && pricing.loading ? (
        <Skeleton className="mt-[20px] h-[160px] rounded-[7px]" />
      ) : (
        <PricingEditor
          key={pricing.data ? "loaded" : "fallback"}
          user={u}
          initial={pricing.data}
          loadError={pricing.error}
          canEdit={canEdit}
          categories={refs.categories}
          brands={refs.brands}
          onSaved={(p) => {
            onSaved(p);
            pricing.reload();
          }}
        />
      )}
    </Card>
  );
}

function PricingEditor({
  user: u,
  initial,
  loadError,
  canEdit,
  categories,
  brands,
  onSaved,
}: {
  user: AdminUser;
  initial: UserPricing | null;
  loadError: string | null;
  canEdit: boolean;
  categories: { slug: string; name: string }[];
  brands: { slug: string; name: string }[];
  onSaved: (p: { discount_pct: number; cashback_pct: number }) => void;
}) {
  const [discount, setDiscount] = useState(numStr(initial?.discount_pct ?? u.discount_pct));
  const [cashback, setCashback] = useState(numStr(initial?.cashback_pct ?? u.cashback_pct));
  const [rules, setRules] = useState<RuleRow[]>(() => (initial?.rules ?? []).map(toRow));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // правила не загрузились — не отправляем их, чтобы не стереть существующие
  const rulesAvailable = initial !== null;
  const listId = `cat-${u.id}`;
  const brandListId = `brand-${u.id}`;

  const setRule = (uid: number, patch: Partial<RuleRow>) => setRules((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));

  const save = async () => {
    setError(null);
    const d = parseNum(discount);
    const c = parseNum(cashback);
    if (d === null || d < 0 || d > 90 || c === null || c < 0 || c > 50) {
      setError("Скидка — от 0 до 90 %, кешбэк — от 0 до 50 %");
      return;
    }
    const out: PricingRule[] = [];
    for (const [i, r] of rules.entries()) {
      const rd = parseNum(r.discount);
      const rc = parseNum(r.cashback);
      if (!r.category_slug.trim() && !r.brand_slug.trim() && !r.product_id.trim()) {
        setError(`Правило ${i + 1}: укажите категорию, бренд или товар`);
        return;
      }
      if (rd === null || rd < 0 || rd > 90 || rc === null || rc < 0 || rc > 50) {
        setError(`Правило ${i + 1}: скидка — от 0 до 90 %, кешбэк — от 0 до 50 %`);
        return;
      }
      out.push({
        category_slug: r.category_slug.trim() || null,
        brand_slug: r.brand_slug.trim() || null,
        product_id: r.product_id.trim() || null,
        discount_pct: rd,
        cashback_pct: rc,
      });
    }
    setBusy(true);
    try {
      await adminApi.savePricing(u.id, { discount_pct: d, cashback_pct: c, ...(rulesAvailable ? { rules: out } : {}) });
      toast.success("Персональные условия сохранены");
      onSaved({ discount_pct: d, cashback_pct: c });
    } catch (e) {
      setError(errorMessage(e, "Не удалось сохранить условия"));
    } finally {
      setBusy(false);
    }
  };

  const pctField = (value: string, onChange: (v: string) => void, aria: string, max: number) => (
    <span className="relative block">
      <Input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" aria-label={aria} disabled={!canEdit} className={cn(fieldCls, "pr-[28px] text-right tnum")} title={`0–${max} %`} />
      <span className="pointer-events-none absolute right-[11px] top-1/2 -translate-y-1/2 text-[14px] text-muted">%</span>
    </span>
  );

  return (
    <div className="mt-[20px]">
      <div className="flex flex-wrap gap-x-[24px] gap-y-[12px]">
        <label className="flex items-center gap-[12px]">
          <span className={labelCls}>Базовая скидка</span>
          <span className="w-[96px]">{pctField(discount, setDiscount, "Базовая скидка, %", 90)}</span>
        </label>
        <label className="flex items-center gap-[12px]">
          <span className={labelCls}>Кешбэк</span>
          <span className="w-[96px]">{pctField(cashback, setCashback, "Кешбэк, %", 50)}</span>
        </label>
      </div>

      <h3 className="mt-[26px] text-[16px] font-semibold leading-[20px]">Правила</h3>
      {!rulesAvailable ? (
        <ErrorLine error={`${sentence(loadError ?? "Правила не загрузились")} Базовую скидку и кешбэк сохранить можно — существующие правила не изменятся.`} className="mt-[12px]" />
      ) : (
        <>
          <div className="-mx-[20px] mt-[12px] overflow-x-auto px-[20px] sm:mx-0 sm:px-0">
            <table className="w-full min-w-[720px] border-collapse text-[15px] leading-[20px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-[6px] pb-[8px] font-normal">Категория</th>
                  <th className="px-[6px] pb-[8px] font-normal">Бренд</th>
                  <th className="px-[6px] pb-[8px] font-normal">Товар (ID)</th>
                  <th className="w-[96px] px-[6px] pb-[8px] font-normal">Скидка</th>
                  <th className="w-[96px] px-[6px] pb-[8px] font-normal">Кешбэк</th>
                  <th className="w-[44px]" aria-label="Удалить" />
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-[6px] py-[24px] text-center text-[#555]">
                      Правил нет — действуют базовые условия
                    </td>
                  </tr>
                ) : (
                  rules.map((r) => (
                    <tr key={r.uid} className="border-b border-line">
                      <td className="px-[6px] py-[8px] align-top">
                        <Input list={listId} value={r.category_slug} onChange={(e) => setRule(r.uid, { category_slug: e.target.value })} placeholder="slug категории" aria-label="Категория" disabled={!canEdit} className={fieldCls} />
                        <RuleHint text={r.category_slug ? (categories.find((c) => c.slug === r.category_slug)?.name ?? r.hint.category) : null} />
                      </td>
                      <td className="px-[6px] py-[8px] align-top">
                        <Input list={brandListId} value={r.brand_slug} onChange={(e) => setRule(r.uid, { brand_slug: e.target.value })} placeholder="slug бренда" aria-label="Бренд" disabled={!canEdit} className={fieldCls} />
                        <RuleHint text={r.brand_slug ? (brands.find((b) => b.slug === r.brand_slug)?.name ?? r.hint.brand) : null} />
                      </td>
                      <td className="px-[6px] py-[8px] align-top">
                        <Input value={r.product_id} onChange={(e) => setRule(r.uid, { product_id: e.target.value })} placeholder="UUID товара" aria-label="Товар" disabled={!canEdit} className={cn(fieldCls, "text-[13px]")} />
                        <RuleHint text={r.product_id === r.hint.productId ? r.hint.product : null} />
                      </td>
                      <td className="px-[6px] py-[8px] align-top">{pctField(r.discount, (v) => setRule(r.uid, { discount: v }), "Скидка по правилу, %", 90)}</td>
                      <td className="px-[6px] py-[8px] align-top">{pctField(r.cashback, (v) => setRule(r.uid, { cashback: v }), "Кешбэк по правилу, %", 50)}</td>
                      <td className="px-[6px] py-[8px] text-right align-top">
                        {canEdit ? (
                          <button type="button" onClick={() => setRules((rs) => rs.filter((x) => x.uid !== r.uid))} className="inline-flex size-[32px] items-center justify-center rounded-[6px] text-sub transition-colors hover:bg-sale-bg hover:text-sale-text" aria-label="Удалить правило">
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <datalist id={listId}>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </datalist>
          <datalist id={brandListId}>
            {brands.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </datalist>
          {canEdit ? (
            <Button
              variant="ghost"
              className={cn(btnCls, "mt-[10px] px-[10px]")}
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => setRules((rs) => [...rs, { uid: rs.reduce((m, x) => Math.max(m, x.uid), 0) + 1, hint: {}, category_slug: "", brand_slug: "", product_id: "", discount: "0", cashback: "0" }])}
            >
              Добавить правило
            </Button>
          ) : null}
        </>
      )}
      <ErrorLine error={error} className="mt-[16px]" />
      {canEdit ? (
        <div className="mt-[20px] border-t border-line pt-[20px]">
          <Button className={btnCls} loading={busy} onClick={save}>
            Сохранить условия
          </Button>
        </div>
      ) : null}
    </div>
  );
}
