"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { toast } from "@/store/toast";

export function ContactForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Укажите имя";
    if (!/^\+?\d[\d\s()-]{6,}$/.test(phone.trim())) next.phone = "Укажите корректный телефон";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    // Заявка обрабатывается менеджером; отправка в CRM появится вместе с модулем обратной связи.
    window.setTimeout(() => {
      setBusy(false);
      setName("");
      setPhone("");
      setMessage("");
      toast.success("Спасибо! Мы свяжемся с вами");
    }, 300);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Имя" htmlFor="cf-name" required error={errors.name}>
        <Input id="cf-name" value={name} onChange={(e) => setName(e.target.value)} invalid={Boolean(errors.name)} autoComplete="name" />
      </Field>
      <Field label="Телефон" htmlFor="cf-phone" required error={errors.phone}>
        <Input id="cf-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} invalid={Boolean(errors.phone)} placeholder="+992" autoComplete="tel" />
      </Field>
      <Field label="Сообщение" htmlFor="cf-msg">
        <Textarea id="cf-msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Какое оборудование вас интересует?" />
      </Field>
      <Button type="submit" loading={busy} className="self-start">
        Отправить
      </Button>
    </form>
  );
}
