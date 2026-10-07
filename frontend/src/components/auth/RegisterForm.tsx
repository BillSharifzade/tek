"use client";

import Link from "next/link";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { passwordValid } from "@/lib/password";
import { isValidPhone, PHONE_ERROR, phoneInputProps } from "@/lib/phone";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { PasswordRules } from "./PasswordRules";
import { AuthAlert } from "./AuthShell";

type CustomerType = "retail" | "legal";

const TYPES: { value: CustomerType; label: string }[] = [
  { value: "retail", label: "Физическое лицо" },
  { value: "legal", label: "Юридическое лицо" },
];

interface State {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  password2: string;
  customer_type: CustomerType;
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
    // e-mail не обязателен (вход — по телефону); если указан — проверяем формат
    if (s.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim())) e.email = "Укажите корректный e-mail";
    if (!isValidPhone(s.phone)) e.phone = PHONE_ERROR;
    if (!passwordValid(s.password, s.email)) e.password = "Пароль не соответствует требованиям";
    if (s.password !== s.password2) e.password2 = "Пароли не совпадают";
    if (s.customer_type === "legal") {
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
    const needCompany = s.customer_type === "legal";
    try {
      await api("/auth/register", {
        method: "POST",
        body: {
          email: s.email.trim() || undefined,
          phone: s.phone,
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
      <div className="flex flex-col items-center py-[12px] text-center">
        <CheckCircle2 className="size-[56px] text-[#00BA00]" strokeWidth={1.5} aria-hidden />
        <h2 className="mt-[16px] text-[20px] font-semibold leading-[24px]">Заявка отправлена на одобрение</h2>
        <p className="mt-[8px] max-w-[420px] text-[14px] leading-[20px] text-sub">
          Регистрация новых аккаунтов проходит через одобрение компании. Как только доступ будет открыт, мы сообщим {s.email.trim() ? "на" : "по телефону"} <span className="font-medium text-black">{s.email.trim() || s.phone}</span>.
        </p>
        <ButtonLink href="/" className="mt-[24px]">
          На главную
        </ButtonLink>
      </div>
    );
  }

  const needCompany = s.customer_type === "legal";

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-[20px]">
      {serverError ? <AuthAlert title={serverError} /> : null}

      <div>
        <p className="mb-[8px] text-[14px] leading-[18px] text-sub">Тип клиента</p>
        <div className="grid grid-cols-1 gap-[9px] sm:grid-cols-2" role="radiogroup" aria-label="Тип клиента">
          {TYPES.map((t) => {
            const active = s.customer_type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set("customer_type", t.value)}
                className={cn(
                  "flex min-h-[56px] flex-col items-start justify-center rounded-[7px] border px-[14px] py-[8px] text-left transition-colors",
                  active ? "border-brand bg-brand-light/50" : "border-transparent bg-btn hover:bg-btn-hover",
                )}
              >
                <span className="text-[14px] font-medium leading-[18px] text-black">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-[12px] gap-y-[14px] sm:grid-cols-2">
        <Field label="Имя" htmlFor="rg-first" required error={errors.first_name}>
          <Input id="rg-first" value={s.first_name} onChange={(e) => set("first_name", e.target.value)} invalid={Boolean(errors.first_name)} autoComplete="given-name" />
        </Field>
        <Field label="Фамилия" htmlFor="rg-last" required error={errors.last_name}>
          <Input id="rg-last" value={s.last_name} onChange={(e) => set("last_name", e.target.value)} invalid={Boolean(errors.last_name)} autoComplete="family-name" />
        </Field>
        <Field label="E-mail" htmlFor="rg-email" error={errors.email}>
          <Input id="rg-email" type="email" value={s.email} onChange={(e) => set("email", e.target.value)} invalid={Boolean(errors.email)} autoComplete="email" />
        </Field>
        <Field label="Номер телефона" htmlFor="rg-phone" required error={errors.phone}>
          <Input id="rg-phone" {...phoneInputProps(s.phone, (v) => set("phone", v))} invalid={Boolean(errors.phone)} placeholder="+992" />
        </Field>
        <Field label="Пароль" htmlFor="rg-pass" required error={errors.password}>
          <Input
            id="rg-pass"
            type={show ? "text" : "password"}
            value={s.password}
            onChange={(e) => set("password", e.target.value)}
            invalid={Boolean(errors.password)}
            autoComplete="new-password"
            right={
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Скрыть пароль" : "Показать пароль"} className="transition-colors hover:text-black">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
        </Field>
        <Field label="Подтверждение пароля" htmlFor="rg-pass2" required error={errors.password2}>
          <Input id="rg-pass2" type={show ? "text" : "password"} value={s.password2} onChange={(e) => set("password2", e.target.value)} invalid={Boolean(errors.password2)} autoComplete="new-password" />
        </Field>
        <PasswordRules password={s.password} userName={s.email} className="-mt-[8px] sm:col-span-2" />
      </div>

      {needCompany ? (
        <div className="rounded-[10px] bg-surface-2 px-[16px] py-[14px]">
          <p className="text-[14px] font-medium leading-[18px] text-black">Данные компании</p>
          <div className="mt-[14px] grid grid-cols-1 gap-x-[12px] gap-y-[14px] sm:grid-cols-2">
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
        </div>
      ) : null}

      <div>
        <Checkbox checked={s.agree} onChange={(e) => set("agree", e.target.checked)} className="items-start" label={<span className="text-[13px] leading-[18px] text-sub">Я согласен(а) на обработку персональных данных и с условиями обслуживания</span>} />
        {errors.agree ? <p className="mt-[4px] text-[13px] leading-[17px] text-sale">{errors.agree}</p> : null}
      </div>

      <Button type="submit" full loading={busy}>
        Отправить заявку
      </Button>
      <p className="-mt-[4px] text-center text-[14px] leading-[20px] text-sub">
        Уже зарегистрированы?{" "}
        <Link href="/login" className="font-medium text-black underline decoration-line-3 underline-offset-[3px] transition-colors hover:decoration-black">
          Войти
        </Link>
      </p>
    </form>
  );
}
