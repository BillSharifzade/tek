"use client";

import { useState } from "react";
import type { User } from "@/lib/types";
import { client } from "@/lib/client";
import { passwordValid } from "@/lib/password";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Checkbox";
import { Field, Input } from "@/components/ui/Input";
import { PasswordRules } from "@/components/auth/PasswordRules";
import { ErrorLine, PageTitle, errorMessage } from "./shared";

interface ProfileForm {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
}

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
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const [notify, setNotify] = useState(() => ({ notify_marketing: user?.notify_marketing ?? false, notify_replies: user?.notify_replies ?? true }));
  const [notifyBusy, setNotifyBusy] = useState<"notify_marketing" | "notify_replies" | null>(null);

  const set = (k: keyof ProfileForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    if (!form.first_name.trim() || !form.email.trim() || !form.phone.trim()) {
      setProfileError("Заполните имя, телефон и e-mail");
      return;
    }
    setProfileBusy(true);
    try {
      const u = await client.put<User>("/account/profile", {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
      });
      setUser(u);
      toast.success("Личные данные сохранены");
    } catch (err) {
      setProfileError(errorMessage(err, "Не удалось сохранить данные"));
    } finally {
      setProfileBusy(false);
    }
  };

  const nextValid = passwordValid(pw.next, user?.email);
  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (!pw.current) return setPwError("Введите текущий пароль");
    if (!nextValid) return setPwError("Новый пароль не соответствует требованиям");
    if (pw.next !== pw.confirm) return setPwError("Пароли не совпадают");
    setPwBusy(true);
    try {
      await client.put("/account/password", { current_password: pw.current, new_password: pw.next });
      setPw({ current: "", next: "", confirm: "" });
      toast.success("Пароль изменён");
    } catch (err) {
      setPwError(errorMessage(err, "Не удалось изменить пароль"));
    } finally {
      setPwBusy(false);
    }
  };

  const toggleNotify = async (key: "notify_marketing" | "notify_replies", value: boolean) => {
    const prev = notify;
    const next = { ...notify, [key]: value };
    setNotify(next);
    setNotifyBusy(key);
    try {
      const u = await client.put<User>("/account/notifications", next);
      if (u && typeof u === "object" && "id" in u) setUser(u);
      else if (user) setUser({ ...user, ...next });
      toast.success("Настройки уведомлений сохранены");
    } catch (err) {
      setNotify(prev);
      toast.error(errorMessage(err, "Не удалось сохранить настройки"));
    } finally {
      setNotifyBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Личные данные</PageTitle>

      <form onSubmit={saveProfile} noValidate className="rounded-[8px] border border-line bg-white p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Имя" htmlFor="p-first" required>
            <Input id="p-first" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} autoComplete="given-name" />
          </Field>
          <Field label="Фамилия" htmlFor="p-last">
            <Input id="p-last" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} autoComplete="family-name" />
          </Field>
          <Field label="Номер телефона" htmlFor="p-phone" required>
            <Input id="p-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" placeholder="+992" />
          </Field>
          <Field label="E-mail" htmlFor="p-email" required>
            <Input id="p-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
          </Field>
        </div>
        <ErrorLine error={profileError} className="mt-4" />
        <div className="mt-5 flex items-center gap-4">
          <Button type="submit" loading={profileBusy} className="uppercase tracking-wide">
            Сохранить
          </Button>
          {user ? (
            <span className="text-sm text-sub">
              Тип клиента: {user.customer_type === "purchaser" ? "закупщик" : user.customer_type === "electrician" ? "электрик" : "физическое лицо"}
            </span>
          ) : null}
        </div>
      </form>

      <section id="password" className="scroll-mt-24 rounded-[8px] border border-line bg-white p-6">
        <h3 className="mb-4">Смена пароля</h3>
        <form onSubmit={savePassword} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Текущий пароль" htmlFor="pw-current" className="sm:col-span-2 sm:max-w-[calc(50%-8px)]">
            <Input id="pw-current" type="password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} autoComplete="current-password" />
          </Field>
          <div className="flex flex-col gap-1.5">
            <Field label="Новый пароль" htmlFor="pw-next">
              <Input id="pw-next" type="password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} autoComplete="new-password" invalid={pw.next.length > 0 && !nextValid} />
            </Field>
            <PasswordRules password={pw.next} userName={user?.email} />
          </div>
          <Field label="Подтверждение пароля" htmlFor="pw-confirm" error={pw.confirm && pw.confirm !== pw.next ? "Пароли не совпадают" : undefined}>
            <Input id="pw-confirm" type="password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} autoComplete="new-password" invalid={Boolean(pw.confirm) && pw.confirm !== pw.next} />
          </Field>
          <div className="sm:col-span-2">
            <ErrorLine error={pwError} className="mb-4" />
            <Button type="submit" loading={pwBusy} className="uppercase tracking-wide">
              Сохранить
            </Button>
          </div>
        </form>
      </section>

      <section id="notifications" className="scroll-mt-24 rounded-[8px] border border-line bg-white p-6">
        <h3 className="mb-4">Настройка уведомлений</h3>
        <div className="flex flex-col divide-y divide-line">
          <Toggle
            className="py-3"
            label="Рекламные рассылки"
            description="Акции, распродажи и новинки на e-mail"
            checked={notify.notify_marketing}
            disabled={notifyBusy === "notify_marketing"}
            onChange={(v) => toggleNotify("notify_marketing", v)}
          />
          <Toggle
            className="py-3"
            label="Ответы на отзывы и вопросы"
            description="Уведомлять, когда специалист ТЭК ответил на ваш отзыв или вопрос"
            checked={notify.notify_replies}
            disabled={notifyBusy === "notify_replies"}
            onChange={(v) => toggleNotify("notify_replies", v)}
          />
        </div>
      </section>
    </div>
  );
}
