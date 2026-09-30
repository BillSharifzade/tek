"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { toast } from "@/store/toast";
import { sendLead } from "@/lib/leads";
import { cn } from "@/lib/cn";

/** Поле формы из макета «Оставьте заявку» (10972:2084): 36px, белое, рамка #E5E5E5, r7, плейсхолдер 14px #666. */
const field =
  "w-full rounded-[7px] border bg-white px-[13px] text-[14px] leading-[20px] text-black transition-colors placeholder:text-sub hover:border-outline focus:border-outline-hover focus:outline-none";

export function ContactForm({
  withEmail = false,
  withConsent = false,
  messagePlaceholder = "Примечание",
  submitLabel = "Оставить заявку",
  className,
}: {
  withEmail?: boolean;
  withConsent?: boolean;
  messagePlaceholder?: string;
  submitLabel?: string;
  className?: string;
}) {
  const uid = useId();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(true);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string; consent?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Укажите имя";
    if (!/^\+?\d[\d\s()-]{6,}$/.test(phone.trim())) next.phone = "Укажите корректный телефон";
    if (withEmail && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Проверьте адрес почты";
    if (withConsent && !consent) next.consent = "Нужно согласие на обработку данных";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    const r = await sendLead({ kind: withEmail ? "feedback" : "question", name: name.trim(), phone: phone.trim(), email: email.trim() || undefined, note: message.trim() });
    setBusy(false);
    if (!r.ok) {
      toast.error(r.message);
      return;
    }
    setName("");
    setPhone("");
    setEmail("");
    setMessage("");
    toast.success("Спасибо! Мы свяжемся с вами");
  };

  const err = (msg?: string) =>
    msg ? (
      <p className="mt-[4px] text-[13px] leading-[16px] text-sale-text" role="alert">
        {msg}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} noValidate className={cn("flex flex-col gap-[13px]", className)}>
      <div>
        <label htmlFor={`${uid}-name`} className="sr-only">
          Имя
        </label>
        <input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" autoComplete="name" aria-invalid={Boolean(errors.name)} className={cn(field, "h-[36px]", errors.name ? "border-sale" : "border-line")} />
        {err(errors.name)}
      </div>
      <div className={cn(withEmail && "grid grid-cols-1 gap-[13px] sm:grid-cols-2")}>
        <div>
          <label htmlFor={`${uid}-phone`} className="sr-only">
            Телефон
          </label>
          <input id={`${uid}-phone`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" autoComplete="tel" inputMode="tel" aria-invalid={Boolean(errors.phone)} className={cn(field, "h-[36px]", errors.phone ? "border-sale" : "border-line")} />
          {err(errors.phone)}
        </div>
        {withEmail ? (
          <div>
            <label htmlFor={`${uid}-email`} className="sr-only">
              Эл. почта
            </label>
            <input id={`${uid}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Эл. почта" autoComplete="email" aria-invalid={Boolean(errors.email)} className={cn(field, "h-[36px]", errors.email ? "border-sale" : "border-line")} />
            {err(errors.email)}
          </div>
        ) : null}
      </div>
      <div>
        <label htmlFor={`${uid}-msg`} className="sr-only">
          {messagePlaceholder}
        </label>
        <textarea id={`${uid}-msg`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={messagePlaceholder} rows={3} className={cn(field, "block min-h-[77px] resize-none border-line py-[14px]")} />
      </div>
      {withConsent ? (
        <div className="pt-[4px]">
          <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} box={16} label="Я согласен(а) на обработку персональных данных" labelClassName="text-[13px] leading-[18px] text-sub" />
          {err(errors.consent)}
        </div>
      ) : null}
      <Button type="submit" size="lg" loading={busy} className="mt-[12px] w-full px-[24px] sm:w-auto sm:self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
