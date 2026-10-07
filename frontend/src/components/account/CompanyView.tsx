"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Company, Dashboard, Manager } from "@/lib/types";
import { client } from "@/lib/client";
import { ApiError } from "@/lib/api";
import { SITE } from "@/lib/site";
import { money, phoneHref } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PHONE_PREFIX, phoneForField, phoneInputProps } from "@/lib/phone";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { saveBtnCls } from "./PersonalView";
import { Card, CardTitle, ErrorLine, btnCls, errorMessage, fieldCls, labelCls } from "./shared";

interface Form {
  name: string;
  inn: string;
  address: string;
  phone: string;
  email: string;
}

const empty: Form = { name: "", inn: "", address: "", phone: "", email: "" };
const toForm = (c: Company): Form => ({ name: c.name ?? "", inn: c.inn ?? "", address: c.address ?? "", phone: phoneForField(c.phone), email: c.email ?? "" });

const editLinkCls = "text-[15px] leading-[20px] text-muted transition-colors hover:text-black";
/** «Акт сверки» (9093:632): 450 15/20 #000, абзацы через 6px. */
const docLinkCls = "w-fit text-[15px] leading-[20px] text-black underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-black";

/**
 * «Данные компании» (Figma 9085:497): слева «Данные компании» (532×225) и «Баланс» (532×167),
 * справа «Персональный менеджер» (304×224) и «Документы» (304×167); между карточками 27px.
 * Реквизиты: подписи 15/23 #555, значения 600 15/23 #000 с x=168, строки через 6px. Реквизиты можно отредактировать («Изменить»).
 */
export function CompanyView() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [company, setCompany] = useState<Company | null | undefined>(undefined);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    client
      .get<Company | null>("/account/company")
      .then((c) => {
        if (cancelled) return;
        setCompany(c ?? null);
        if (c) setForm(toForm(c));
        else setEditing(true);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          setCompany(null);
          setEditing(true);
        } else {
          setCompany(null);
          setError(errorMessage(e));
        }
      });
    client
      .get<Dashboard>("/account/dashboard")
      .then((d) => {
        if (!cancelled) setDash(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.inn.trim() || !form.address.trim()) {
      setError("Заполните наименование, ИНН и адрес");
      return;
    }
    if (!/^\d{9}$/.test(form.inn.trim())) {
      setError("ИНН должен состоять из 9 цифр");
      return;
    }
    setBusy(true);
    try {
      const c = await client.put<Company>("/account/company", {
        name: form.name.trim(),
        inn: form.inn.trim(),
        address: form.address.trim(),
        // в поле мог остаться только префикс +992 (Enter без потери фокуса) — это «не указан»
        phone: form.phone.trim() && form.phone !== PHONE_PREFIX ? form.phone : null,
        email: form.email.trim() || null,
      });
      setCompany(c);
      setForm(toForm(c));
      setEditing(false);
      if (user) setUser({ ...user, company: c });
      toast.success("Данные компании сохранены");
    } catch (err) {
      setError(errorMessage(err, "Не удалось сохранить данные компании"));
    } finally {
      setBusy(false);
    }
  };

  const manager: Manager | null = dash?.manager ?? user?.manager ?? null;
  const overdue = dash?.balance.overdue ?? 0;

  return (
    <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-[27px]">
      <Card className="lg:min-h-[225px]">
        <CardTitle
          right={
            company && !editing ? (
              <button type="button" className={editLinkCls} onClick={() => setEditing(true)}>
                Изменить
              </button>
            ) : null
          }
        >
          Данные компании
        </CardTitle>
        {company === undefined ? (
          <Skeleton className="mt-[21px] h-[92px] rounded-[7px]" />
        ) : editing ? (
          <form onSubmit={save} noValidate className="mt-[21px] flex flex-col gap-[12px]">
            {!company ? <p className="rounded-[7px] bg-brand-light px-[14px] py-[10px] text-[14px] leading-[18px] text-g333">Оплата по счёту доступна после заполнения данных компании</p> : null}
            <Input aria-label="Наименование" placeholder="Наименование, например ООО “Точикэлектрокомплект”" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="organization" className={fieldCls} />
            <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
              <Input aria-label="ИНН" placeholder="ИНН (9 цифр)" value={form.inn} onChange={(e) => set("inn", e.target.value.replace(/\D/g, "").slice(0, 9))} inputMode="numeric" className={cn(fieldCls, "tnum")} />
              <Input aria-label="Телефон" placeholder="Телефон" {...phoneInputProps(form.phone, (v) => set("phone", v))} className={fieldCls} />
            </div>
            <Textarea aria-label="Адрес" placeholder="Адрес" value={form.address} onChange={(e) => set("address", e.target.value)} className={cn(fieldCls, "h-auto min-h-[72px] py-[8px]")} />
            <Input aria-label="E-mail компании" placeholder="E-mail" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={fieldCls} />
            <ErrorLine error={error} />
            <div className="mt-[8px] flex items-center gap-[12px]">
              <Button type="submit" loading={busy} className={cn(saveBtnCls, "w-[135px] px-0")}>
                Сохранить
              </Button>
              {company ? (
                <Button
                  variant="outline"
                  className={btnCls}
                  disabled={busy}
                  onClick={() => {
                    setForm(toForm(company));
                    setEditing(false);
                    setError(null);
                  }}
                >
                  Отмена
                </Button>
              ) : null}
            </div>
          </form>
        ) : company ? (
          <dl className="mt-[21px] grid grid-cols-[112px_minmax(0,1fr)] gap-x-[20px] gap-y-[6px] text-[15px] leading-[23px] sm:grid-cols-[148px_minmax(0,1fr)]">
            <Row label="Наименование">{company.name}</Row>
            <Row label="ИНН">
              <span className="tnum">{company.inn}</span>
            </Row>
            <Row label="Адрес">{company.address}</Row>
            {company.phone ? (
              <Row label="Телефон">
                <a href={phoneHref(company.phone)} className="link-hover tnum">
                  {company.phone}
                </a>
              </Row>
            ) : null}
            {company.email ? <Row label="E-mail">{company.email}</Row> : null}
          </dl>
        ) : (
          <ErrorLine error={error} className="mt-[21px]" />
        )}
      </Card>

      <Card className="lg:min-h-[224px]">
        <CardTitle>Персональный менеджер</CardTitle>
        {/* 9100:709: имя 600 15 #000, телефон и e-mail 15 #555; строки по ~21px (центры 78/99/121 от верха карточки) */}
        {manager ? (
          <div className="mt-[22px] flex flex-col text-[15px] leading-[21px] text-[#555]">
            <span className="font-semibold text-black">{manager.name}</span>
            <a href={phoneHref(manager.phone)} className="link-hover w-fit tnum">
              {manager.phone}
            </a>
            <a href={`mailto:${manager.email}`} className="link-hover w-fit">
              {manager.email}
            </a>
          </div>
        ) : (
          <div className="mt-[22px] flex flex-col text-[15px] leading-[21px] text-[#555]">
            <span>Менеджер будет закреплён после первого заказа. До этого — единая линия:</span>
            <a href={SITE.phoneHref} className="link-hover w-fit font-semibold text-black tnum">
              {SITE.phone}
            </a>
          </div>
        )}
      </Card>

      <Card className="lg:min-h-[167px]">
        <CardTitle
          right={
            <Link href="/account/balance" className={editLinkCls}>
              Подробнее
            </Link>
          }
        >
          Баланс
        </CardTitle>
        {/* 9089:552 / 9100:704: подпись 15/20 #555, через 6px сумма Bold 17/20; вторая колонка — с x=257 */}
        {dash ? (
          <div className="mt-[21px] grid grid-cols-1 gap-[16px] sm:grid-cols-2 sm:gap-[20px] xl:grid-cols-[257px_minmax(0,1fr)] xl:gap-0">
            <div className="flex flex-col gap-[6px]">
              <span className={labelCls}>Дебиторская задолженность</span>
              <span className="text-[17px] font-bold leading-[20px] tnum">{money(dash.balance.receivable)}</span>
            </div>
            <div className="flex flex-col gap-[6px]">
              <span className={labelCls}>Просроченная задолженность</span>
              <span className={cn("text-[17px] font-bold leading-[20px] tnum", overdue > 0 ? "text-[#D13B3E]" : "text-black")}>{money(overdue)}</span>
            </div>
          </div>
        ) : (
          <Skeleton className="mt-[21px] h-[48px] rounded-[7px]" />
        )}
      </Card>

      <Card className="lg:min-h-[167px]">
        <CardTitle>Документы</CardTitle>
        <div className="mt-[21px] flex flex-col gap-[6px]">
          <Link href="/account/balance" className={docLinkCls}>
            Акт сверки
          </Link>
          <Link href="/account/documents" className={docLinkCls}>
            Счета, акты и договоры
          </Link>
          <Link href="/account/documents#estimates" className={docLinkCls}>
            Сохранённые сметы
          </Link>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-[#555]">{label}</dt>
      <dd className="min-w-0 font-semibold text-black">{children}</dd>
    </>
  );
}
