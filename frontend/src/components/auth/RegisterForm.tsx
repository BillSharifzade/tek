"use client";

import Link from "next/link";
import { Building2, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { passwordValid } from "@/lib/password";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { PasswordRules } from "./PasswordRules";

const TYPES: { value: "retail" | "electrician" | "purchaser"; label: string; hint: string }[] = [
  { value: "retail", label: "Физическое лицо", hint: "Розница" },
  { value: "electrician", label: "Электрик", hint: "B2B / B2C, средний и крупный опт" },
  { value: "purchaser", label: "Закупщик", hint: "B2B, средний и крупный опт" },
];

interface State {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  password2: string;
  customer_type: "retail" | "electrician" | "purchaser";
  withCompany: boolean;
  company_name: string;
  inn: string;
  address: string;
  agree: boolean;
}

type Errors = Partial<Record<keyof State, string>>;

export function RegisterForm() {
  const [s, setS] = useState<State>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    password2: "",
    customer_type: "retail",
    withCompany: false,
    company_name: "",
    inn: "",
    address: "",
    agree: true,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const set = <K extends keyof State>(k: K, v: State[K]) => {
    setS((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = (): boolean => {
    const e: Errors = {};
    if (!s.first_name.trim()) e.first_name = "Укажите имя";
    if (!s.last_name.trim()) e.last_name = "Укажите фамилию";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim())) e.email = "Укажите корректный e-mail";
    if (!/^\+?\d[\d\s()-]{6,}$/.test(s.phone.trim())) e.phone = "Укажите корректный телефон";
    if (!passwordValid(s.password, s.email)) e.password = "Пароль не соответствует требованиям";
    if (s.password !== s.password2) e.password2 = "Пароли не совпадают";
    const needCompany = s.withCompany || s.customer_type === "purchaser";
    if (needCompany) {
      if (!s.company_name.trim()) e.company_name = "Укажите наименование";
      if (!/^\d{9,12}$/.test(s.inn.trim())) e.inn = "ИНН: 9–12 цифр";
      if (!s.address.trim()) e.address = "Укажите адрес";
    }
    if (!s.agree) e.agree = "Необходимо согласие";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setBusy(true);
    const needCompany = s.withCompany || s.customer_type === "purchaser";
    try {
      await api("/auth/register", {
        method: "POST",
        body: {
          email: s.email.trim(),
          phone: s.phone.trim(),
          password: s.password,
          first_name: s.first_name.trim(),
          last_name: s.last_name.trim(),
          customer_type: s.customer_type,
          company: needCompany ? { name: s.company_name.trim(), inn: s.inn.trim(), address: s.address.trim() } : undefined,
        },
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setServerError("Пользователь с таким e-mail или телефоном уже зарегистрирован.");
      else setServerError(err instanceof ApiError ? err.message : "Не удалось отправить заявку. Попробуйте позже");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <CheckCircle2 className="size-14 text-success" strokeWidth={1.5} />
        <h2 className="mt-4">Заявка отправлена на одобрение</h2>
        <p className="mt-2 max-w-sm text-sub">
          Регистрация новых аккаунтов проходит через одобрение компании. Как только доступ будет открыт, мы сообщим на <span className="font-medium text-ink">{s.email}</span>.
        </p>
        <ButtonLink href="/" className="mt-6">
          На главную
        </ButtonLink>
      </div>
    );
  }

  const needCompany = s.withCompany || s.customer_type === "purchaser";

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {serverError ? (
        <div role="alert" className="rounded-[6px] border border-sale/30 bg-sale/5 px-4 py-3 text-sm font-medium text-sale">
          {serverError}
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-sm text-sub">Тип клиента</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Тип клиента">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={s.customer_type === t.value}
              onClick={() => set("customer_type", t.value)}
              className={cn("flex flex-col items-start rounded-[6px] border px-3 py-2.5 text-left transition-colors", s.customer_type === t.value ? "border-brand bg-brand-light/50" : "border-line hover:border-ink")}
            >
              <span className="text-base font-medium">{t.label}</span>
              <span className="text-xs text-sub">{t.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Имя" htmlFor="rg-first" required error={errors.first_name}>
          <Input id="rg-first" value={s.first_name} onChange={(e) => set("first_name", e.target.value)} invalid={Boolean(errors.first_name)} autoComplete="given-name" />
        </Field>
        <Field label="Фамилия" htmlFor="rg-last" required error={errors.last_name}>
          <Input id="rg-last" value={s.last_name} onChange={(e) => set("last_name", e.target.value)} invalid={Boolean(errors.last_name)} autoComplete="family-name" />
        </Field>
        <Field label="E-mail" htmlFor="rg-email" required error={errors.email}>
          <Input id="rg-email" type="email" value={s.email} onChange={(e) => set("email", e.target.value)} invalid={Boolean(errors.email)} autoComplete="email" />
        </Field>
        <Field label="Номер телефона" htmlFor="rg-phone" required error={errors.phone}>
          <Input id="rg-phone" type="tel" value={s.phone} onChange={(e) => set("phone", e.target.value)} invalid={Boolean(errors.phone)} placeholder="+992" autoComplete="tel" />
        </Field>
        <Field label="Пароль" htmlFor="rg-pass" required error={errors.password} className="sm:col-span-2">
          <Input
            id="rg-pass"
            type={show ? "text" : "password"}
            value={s.password}
            onChange={(e) => set("password", e.target.value)}
            invalid={Boolean(errors.password)}
            autoComplete="new-password"
            right={
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Скрыть пароль" : "Показать пароль"} className="hover:text-ink">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
          <PasswordRules password={s.password} userName={s.email} />
        </Field>
        <Field label="Подтверждение пароля" htmlFor="rg-pass2" required error={errors.password2} className="sm:col-span-2">
          <Input id="rg-pass2" type={show ? "text" : "password"} value={s.password2} onChange={(e) => set("password2", e.target.value)} invalid={Boolean(errors.password2)} autoComplete="new-password" />
        </Field>
      </div>

      <div className="rounded-[8px] border border-line bg-surface-2 p-4">
        <Checkbox
          checked={needCompany}
          disabled={s.customer_type === "purchaser"}
          onChange={(e) => set("withCompany", e.target.checked)}
          label={
            <span className="flex items-center gap-2 font-medium">
              <Building2 className="size-4 text-sub" />
              Данные компании
              {s.customer_type === "purchaser" ? <span className="text-xs font-normal text-sub">(обязательно для закупщиков)</span> : null}
            </span>
          }
        />
        {needCompany ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Наименование" htmlFor="rg-company" required error={errors.company_name} className="sm:col-span-2">
              <Input id="rg-company" value={s.company_name} onChange={(e) => set("company_name", e.target.value)} invalid={Boolean(errors.company_name)} placeholder="ООО «Компания»" autoComplete="organization" />
            </Field>
            <Field label="ИНН" htmlFor="rg-inn" required error={errors.inn}>
              <Input id="rg-inn" inputMode="numeric" value={s.inn} onChange={(e) => set("inn", e.target.value)} invalid={Boolean(errors.inn)} />
            </Field>
            <Field label="Адрес" htmlFor="rg-address" required error={errors.address}>
              <Input id="rg-address" value={s.address} onChange={(e) => set("address", e.target.value)} invalid={Boolean(errors.address)} autoComplete="street-address" />
            </Field>
          </div>
        ) : null}
      </div>

      <Checkbox checked={s.agree} onChange={(e) => set("agree", e.target.checked)} label={<span className="text-sm text-sub">Я согласен(а) на обработку персональных данных и с условиями обслуживания</span>} />
      {errors.agree ? <p className="-mt-3 text-sm text-sale">{errors.agree}</p> : null}

      <Button type="submit" size="lg" full loading={busy}>
        Отправить заявку
      </Button>
      <p className="text-center text-sm text-sub">
        Уже зарегистрированы?{" "}
        <Link href="/login" className="font-medium text-info hover:underline">
          Войти
        </Link>
      </p>
    </form>
  );
}
