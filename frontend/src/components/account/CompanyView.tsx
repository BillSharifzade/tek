"use client";

import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Company } from "@/lib/types";
import { client } from "@/lib/client";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorLine, PageTitle, errorMessage } from "./shared";

interface Form {
  name: string;
  inn: string;
  address: string;
  phone: string;
  email: string;
}

const empty: Form = { name: "", inn: "", address: "", phone: "", email: "" };

export function CompanyView() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [form, setForm] = useState<Form | null>(null);
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    client
      .get<Company | null>("/account/company")
      .then((c) => {
        if (cancelled) return;
        if (c) {
          setForm({ name: c.name ?? "", inn: c.inn ?? "", address: c.address ?? "", phone: c.phone ?? "", email: c.email ?? "" });
          setExists(true);
        } else {
          setForm(empty);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setForm(empty);
        else setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (k: keyof Form, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
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
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      });
      setExists(true);
      if (user) setUser({ ...user, company: c });
      toast.success("Данные компании сохранены");
    } catch (err) {
      setError(errorMessage(err, "Не удалось сохранить данные компании"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Данные компании</PageTitle>
      {!form ? (
        <Skeleton className="h-64" />
      ) : (
        <form onSubmit={save} noValidate className="rounded-[8px] border border-line bg-white p-6">
          {!exists ? (
            <p className="mb-5 flex items-start gap-2 rounded-[6px] bg-brand-light px-4 py-3 text-sm">
              <Building2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              Оплата по счёту доступна после заполнения данных компании
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Наименование" htmlFor="c-name" required className="sm:col-span-2">
              <Input id="c-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="ООО “Точикэлектрокомплект”" autoComplete="organization" />
            </Field>
            <Field label="ИНН" htmlFor="c-inn" required>
              <Input id="c-inn" value={form.inn} onChange={(e) => set("inn", e.target.value.replace(/\D/g, "").slice(0, 9))} inputMode="numeric" placeholder="123123123" className="tnum" />
            </Field>
            <Field label="Телефон" htmlFor="c-phone">
              <Input id="c-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+992" />
            </Field>
            <Field label="Адрес" htmlFor="c-address" required className="sm:col-span-2">
              <Textarea id="c-address" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Таджикистан, 734060, г. Душанбе, ул. Исмоили Сомони 68/13" className="min-h-[72px]" />
            </Field>
            <Field label="E-mail" htmlFor="c-email">
              <Input id="c-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
          </div>
          <ErrorLine error={error} className="mt-4" />
          <div className="mt-5">
            <Button type="submit" loading={busy} className="uppercase tracking-wide">
              Сохранить
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
