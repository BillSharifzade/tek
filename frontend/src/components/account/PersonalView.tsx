"use client";

import { useState } from "react";
import type { User } from "@/lib/types";
import { client } from "@/lib/client";
import { passwordValid } from "@/lib/password";
import { cn } from "@/lib/cn";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { PasswordRules } from "@/components/auth/PasswordRules";
import { Card, CardTitle, ErrorLine, errorMessage, fieldCls } from "./shared";

interface ProfileForm {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
}

type NotifyKey = "notify_marketing" | "notify_replies";

const CUSTOMER_TYPE: Record<User["customer_type"], string> = { retail: "физическое лицо", electrician: "электрик", purchaser: "закупщик" };

/** Жёлтая обводка из макета («СОХРАНИТЬ», 9085:409), размер/радиус — как у кнопок сайта (44px, r6). */
export const saveBtnCls = "border border-brand bg-white font-bold uppercase tracking-[0.02em] text-brand hover:border-brand-hover hover:bg-brand-hover hover:text-black";

function field(invalid?: boolean) {
  return cn(fieldCls, invalid && "border-sale hover:border-sale focus:border-sale");
}

/**
 * «Личные данные» (Figma 9085:409): одна карточка — Личные данные (4 поля), Смена пароля (с правилами),
 * Настройка уведомлений (чекбоксы) и общая кнопка «СОХРАНИТЬ».
 */
export function PersonalView() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  // AccountGuard renders this view only when the user is loaded, so lazy init is safe.
  const [form, setForm] = useState<ProfileForm>(() => ({
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    phone: user?.phone ?? "",
    email: user?.email ?? "",
  }));
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [notify, setNotify] = useState<Record<NotifyKey, boolean>>(() => ({ notify_marketing: user?.notify_marketing ?? false, notify_replies: user?.notify_replies ?? true }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<Partial<Record<keyof ProfileForm | "current" | "next" | "confirm", boolean>>>({});

  const set = (k: keyof ProfileForm, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setInvalid((i) => ({ ...i, [k]: false }));
  };
  const setP = (k: "current" | "next" | "confirm", v: string) => {
    setPw((p) => ({ ...p, [k]: v }));
    setInvalid((i) => ({ ...i, [k]: false }));
  };

  const wantPassword = Boolean(pw.next || pw.confirm);

  // e-mail — это логин: сменить его можно только с текущим паролем
  const emailChanged = Boolean(user && form.email.trim().toLowerCase() !== user.email.toLowerCase());

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const bad: typeof invalid = {};
    if (!form.first_name.trim()) bad.first_name = true;
    if (form.phone.replace(/\D/g, "").length < 9) bad.phone = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) bad.email = true;
    if (Object.keys(bad).length) {
      setInvalid(bad);
      setError("Заполните имя, телефон и корректный e-mail");
      return;
    }
    if (emailChanged && !pw.current) {
      setInvalid({ current: true });
      return setError("Введите текущий пароль, чтобы сменить e-mail");
    }
    if (wantPassword) {
      if (!passwordValid(pw.next, user?.email)) {
        setInvalid({ next: true });
        return setError("Новый пароль не соответствует требованиям");
      }
      if (pw.next !== pw.confirm) {
        setInvalid({ confirm: true });
        return setError("Пароли не совпадают");
      }
      if (!pw.current) {
        setInvalid({ current: true });
        return setError("Введите текущий пароль, чтобы сменить его");
      }
    }

    setBusy(true);
    let latest = user;
    try {
      const profile = { first_name: form.first_name.trim(), last_name: form.last_name.trim(), phone: form.phone.trim(), email: form.email.trim() };
      const profileChanged = !user || (Object.keys(profile) as (keyof ProfileForm)[]).some((k) => profile[k] !== (user[k] ?? ""));
      if (profileChanged) {
        latest = await client.put<User>("/account/profile", emailChanged ? { ...profile, current_password: pw.current } : profile);
        setUser(latest);
      }
      const notifyChanged = !latest || latest.notify_marketing !== notify.notify_marketing || latest.notify_replies !== notify.notify_replies;
      if (notifyChanged) {
        const u = await client.put<User>("/account/notifications", notify);
        if (u && typeof u === "object" && "id" in u) latest = u;
        else if (latest) latest = { ...latest, ...notify };
        if (latest) setUser(latest);
      }
      if (wantPassword) {
        await client.put("/account/password", { current_password: pw.current, new_password: pw.next });
        setPw({ current: "", next: "", confirm: "" });
      }
      toast.success(profileChanged || notifyChanged || wantPassword ? (wantPassword ? "Данные сохранены, пароль изменён" : "Личные данные сохранены") : "Изменений нет");
    } catch (err) {
      setError(errorMessage(err, "Не удалось сохранить изменения"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="lg:min-h-[518px]">
      <form onSubmit={save} noValidate>
        <CardTitle right={user ? <span className="text-[14px] leading-[20px] text-sub">Тип клиента: {CUSTOMER_TYPE[user.customer_type] ?? "физическое лицо"}</span> : null}>Личные данные</CardTitle>
        <div className="mt-[21px] grid grid-cols-1 gap-[12px] sm:grid-cols-2">
          <Input aria-label="Имя" placeholder="Имя" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} autoComplete="given-name" className={field(invalid.first_name)} aria-invalid={invalid.first_name || undefined} />
          <Input aria-label="Фамилия" placeholder="Фамилия" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} autoComplete="family-name" className={field()} />
          <Input aria-label="Номер телефона" placeholder="Номер телефона" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" className={field(invalid.phone)} aria-invalid={invalid.phone || undefined} />
          <Input aria-label="E-mail" placeholder="E-mail" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" className={field(invalid.email)} aria-invalid={invalid.email || undefined} />
        </div>

        <CardTitle as="h3" className="mt-[30px]">
          <span id="password">Смена пароля</span>
        </CardTitle>
        <div className="mt-[21px] grid grid-cols-1 gap-[12px] sm:grid-cols-2">
          <div>
            <Input aria-label="Новый пароль" placeholder="Новый пароль" type="password" value={pw.next} onChange={(e) => setP("next", e.target.value)} autoComplete="new-password" className={field(invalid.next)} />
            <PasswordRules password={pw.next} userName={user?.email} className="mt-[2px]" />
          </div>
          <div className="flex flex-col gap-[12px]">
            <Input aria-label="Подтверждение пароля" placeholder="Подтверждение пароля" type="password" value={pw.confirm} onChange={(e) => setP("confirm", e.target.value)} autoComplete="new-password" className={field(invalid.confirm || Boolean(pw.confirm && pw.confirm !== pw.next))} />
            {wantPassword || emailChanged ? (
              <Input aria-label="Текущий пароль" placeholder="Текущий пароль" type="password" value={pw.current} onChange={(e) => setP("current", e.target.value)} autoComplete="current-password" className={field(invalid.current)} />
            ) : null}
          </div>
        </div>

        <CardTitle as="h3" className="mt-[28px]">
          <span id="notifications">Настройка уведомлений</span>
        </CardTitle>
        <div className="mt-[19px] flex flex-col items-start gap-[14px]">
          <Checkbox
            box={20}
            className="gap-[10px]"
            checked={notify.notify_marketing}
            onChange={(e) => setNotify((n) => ({ ...n, notify_marketing: e.target.checked }))}
            label={<span className="text-[14px] leading-[20px] text-sub">Рекламные рассылки</span>}
          />
          <Checkbox
            box={20}
            className="gap-[10px]"
            checked={notify.notify_replies}
            onChange={(e) => setNotify((n) => ({ ...n, notify_replies: e.target.checked }))}
            label={<span className="text-[14px] leading-[20px] text-sub">Ответы специалистов на мои отзывы и вопросы</span>}
          />
        </div>

        <ErrorLine error={error} className="mt-[24px]" />
        <Button type="submit" loading={busy} className={cn(saveBtnCls, "mt-[30px] w-[135px] px-0")}>
          Сохранить
        </Button>
      </form>
    </Card>
  );
}
