"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, MapPin, Store, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Cart, CheckoutOptions, CheckoutPayload, CheckoutResult } from "@/lib/types";
import { client } from "@/lib/client";
import { ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useCart } from "@/store/cart";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { useHydrated } from "@/lib/hooks";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Radio } from "@/components/ui/Checkbox";
import { Skeleton } from "@/components/ui/Skeleton";
import { CartSummary } from "@/components/cart/CartSummary";
import { ImageBox } from "@/components/ui/ImageBox";
import { rememberOrderEmail } from "@/components/account/OrderSummaryCard";

interface FormState {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  method: string;
  address: string;
  date: string;
  store_id: number | null;
  payment: string;
  comment: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[8px] border border-line bg-white p-6">
      <h2 className="mb-5 flex items-center gap-3 text-xl">
        <span className="flex size-7 items-center justify-center rounded-full bg-brand text-sm font-bold">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function CheckoutView() {
  const router = useRouter();
  const hydrated = useHydrated();
  const user = useAuth((s) => s.user);
  const { cart, loaded, setCart } = useCart();
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [form, setForm] = useState<FormState>({ first_name: "", last_name: "", phone: "", email: "", method: "courier", address: "", date: "", store_id: null, payment: "", comment: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    client
      .get<CheckoutOptions>("/checkout/options")
      .then((o) => {
        setOptions(o);
        setForm((f) => ({
          ...f,
          method: f.method || o.delivery_methods[0]?.code || "courier",
          date: f.date || o.delivery_dates.find((d) => d.available)?.date || "",
          store_id: f.store_id ?? o.stores[0]?.id ?? null,
          payment: f.payment || o.payment_methods.find((p) => p.available)?.code || "",
        }));
      })
      .catch(() => toast.error("Не удалось загрузить параметры доставки"));
  }, []);

  if (user && !prefilled) {
    // first render with a known user → prefill contact fields once (derived-state pattern, no effect)
    setPrefilled(true);
    setForm((f) => ({ ...f, first_name: user.first_name, last_name: user.last_name, phone: user.phone, email: user.email, address: user.company?.address ?? f.address }));
  }

  const selectedItems = useMemo(() => cart?.items.filter((i) => i.selected) ?? [], [cart]);
  const deliveryMethod = options?.delivery_methods.find((m) => m.code === form.method);
  const deliveryPrice = form.method === "pickup" ? 0 : (deliveryMethod?.price ?? 0);

  if (!hydrated || !loaded || !options) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-56" />
          <Skeleton className="h-64" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!cart || selectedItems.length === 0) {
    return (
      <div className="rounded-[8px] border border-dashed border-line py-16 text-center">
        <p className="text-lg font-semibold">В корзине нет выбранных товаров</p>
        <p className="mt-1 text-sm text-sub">Отметьте товары в корзине, чтобы оформить заказ.</p>
        <ButtonLink href="/cart" className="mt-6">
          Перейти в корзину
        </ButtonLink>
      </div>
    );
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = (): boolean => {
    const e: Errors = {};
    if (!form.first_name.trim()) e.first_name = "Укажите имя";
    if (!form.last_name.trim()) e.last_name = "Укажите фамилию";
    if (!/^\+?\d[\d\s()-]{6,}$/.test(form.phone.trim())) e.phone = "Укажите корректный номер телефона";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Укажите корректный e-mail";
    if (form.method !== "pickup" && !form.address.trim()) e.address = "Укажите адрес доставки";
    if (form.method !== "pickup" && !form.date) e.date = "Выберите дату доставки";
    if (form.method === "pickup" && !form.store_id) e.store_id = "Выберите магазин";
    if (!form.payment) e.payment = "Выберите способ оплаты";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) {
      toast.error("Проверьте заполнение формы");
      return;
    }
    setBusy(true);
    const payload: CheckoutPayload = {
      contact: { first_name: form.first_name.trim(), last_name: form.last_name.trim(), phone: form.phone.trim(), email: form.email.trim() },
      delivery:
        form.method === "pickup"
          ? { method: "pickup", store_id: form.store_id ?? undefined }
          : { method: form.method, address: form.address.trim(), date: form.date },
      payment: { method: form.payment },
      comment: form.comment.trim() || undefined,
    };
    try {
      const r = await client.post<CheckoutResult>("/checkout", payload);
      rememberOrderEmail(payload.contact.email);
      try {
        setCart(await client.get<Cart>("/cart"));
      } catch {
        /* ignore */
      }
      if (r.payment.kind === "redirect" && r.payment.url) {
        window.location.href = r.payment.url;
        return;
      }
      router.push(`/checkout/success/${r.order.number}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "insufficient_stock") {
        toast.error("Некоторых товаров недостаточно в наличии. Проверьте корзину.");
        router.push("/cart");
      } else {
        toast.error(e instanceof ApiError ? e.message : "Не удалось оформить заказ");
      }
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Step n={1} title="Контактные данные">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Имя" htmlFor="co-first" required error={errors.first_name}>
              <Input id="co-first" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} invalid={Boolean(errors.first_name)} autoComplete="given-name" />
            </Field>
            <Field label="Фамилия" htmlFor="co-last" required error={errors.last_name}>
              <Input id="co-last" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} invalid={Boolean(errors.last_name)} autoComplete="family-name" />
            </Field>
            <Field label="Телефон" htmlFor="co-phone" required error={errors.phone}>
              <Input id="co-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} invalid={Boolean(errors.phone)} placeholder="+992" autoComplete="tel" />
            </Field>
            <Field label="E-mail" htmlFor="co-email" required error={errors.email}>
              <Input id="co-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} invalid={Boolean(errors.email)} autoComplete="email" />
            </Field>
          </div>
          {!user ? (
            <p className="mt-4 text-sm text-sub">
              Уже есть аккаунт?{" "}
              <Link href="/login?next=/checkout" className="text-info hover:underline">
                Войдите
              </Link>
              , чтобы получить персональные цены и кешбэк.
            </p>
          ) : null}
        </Step>

        <Step n={2} title="Способ получения">
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-[8px] bg-surface p-1" role="radiogroup" aria-label="Способ получения">
            {options.delivery_methods.map((m) => {
              const Icon = m.code === "pickup" ? Store : Truck;
              const active = form.method === m.code;
              return (
                <button
                  key={m.code}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set("method", m.code)}
                  className={cn("flex h-11 items-center justify-center gap-2 rounded-[6px] text-base font-medium transition-colors", active ? "bg-white shadow-sm" : "text-sub hover:text-ink")}
                >
                  <Icon className="size-4" />
                  {m.label}
                  <span className="text-xs text-sub">{m.price > 0 ? money(m.price) : "бесплатно"}</span>
                </button>
              );
            })}
          </div>

          {form.method === "pickup" ? (
            <div className="flex flex-col gap-3" role="radiogroup" aria-label="Магазин самовывоза">
              {options.stores.map((s) => (
                <label key={s.id} className={cn("flex cursor-pointer items-start gap-3 rounded-[8px] border p-4 transition-colors", form.store_id === s.id ? "border-brand bg-brand-light/40" : "border-line hover:border-muted")}>
                  <Radio name="store" checked={form.store_id === s.id} onChange={() => set("store_id", s.id)} />
                  <span>
                    <span className="block text-base font-medium">
                      {s.city} · {s.name}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-sm text-sub">
                      <MapPin className="size-3.5" />
                      {s.address}
                    </span>
                  </span>
                </label>
              ))}
              {errors.store_id ? <p className="text-sm text-sale">{errors.store_id}</p> : null}
            </div>
          ) : (
            <>
              <Field label="Адрес доставки" htmlFor="co-address" required error={errors.address} hint={deliveryMethod?.description}>
                <Input id="co-address" value={form.address} onChange={(e) => set("address", e.target.value)} invalid={Boolean(errors.address)} placeholder="Город, улица, дом, офис" autoComplete="street-address" />
              </Field>
              <div className="mt-5">
                <p className="mb-2 text-sm text-sub">
                  Дата доставки<span className="text-sale"> *</span>
                </p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Дата доставки">
                  {options.delivery_dates.map((d) => {
                    const active = form.date === d.date;
                    return (
                      <button
                        key={d.date}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={!d.available}
                        onClick={() => set("date", d.date)}
                        className={cn(
                          "flex min-w-[120px] flex-col items-start rounded-[6px] border px-4 py-2.5 text-left transition-colors",
                          active ? "border-brand bg-brand-light/50" : "border-line hover:border-ink",
                          !d.available && "cursor-not-allowed opacity-50 hover:border-line",
                        )}
                      >
                        <span className="text-base font-semibold">{d.label}</span>
                        <span className="text-sm text-sub">{d.available ? d.day_label : "Недоступно"}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.date ? <p className="mt-2 text-sm text-sale">{errors.date}</p> : null}
              </div>
              <p className="mt-4 flex items-start gap-2 rounded-[6px] bg-surface px-3 py-2.5 text-sm text-sub">
                <Info className="mt-0.5 size-4 shrink-0" />
                {options.note}
              </p>
            </>
          )}
        </Step>

        <Step n={3} title="Способ оплаты">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Способ оплаты">
            {options.payment_methods.map((p) => (
              <label
                key={p.code}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-[8px] border p-4 transition-colors",
                  form.payment === p.code ? "border-brand bg-brand-light/40" : "border-line hover:border-muted",
                  !p.available && "cursor-not-allowed opacity-50",
                )}
              >
                <Radio name="payment" checked={form.payment === p.code} disabled={!p.available} onChange={() => set("payment", p.code)} />
                <span>
                  <span className="block text-base font-medium">{p.label}</span>
                  <span className="block text-sm text-sub">{p.sublabel}</span>
                </span>
              </label>
            ))}
          </div>
          {errors.payment ? <p className="mt-2 text-sm text-sale">{errors.payment}</p> : null}
        </Step>

        <Step n={4} title="Комментарий к заказу">
          <Textarea value={form.comment} onChange={(e) => set("comment", e.target.value)} placeholder="Пожелания по доставке, контактное лицо на объекте и т. д." aria-label="Комментарий к заказу" />
        </Step>
      </div>

      <div className="lg:sticky lg:top-[100px] lg:self-start">
        <div className="mb-4 rounded-[8px] border border-line bg-white p-4">
          <p className="mb-3 text-sm font-semibold">Товары ({selectedItems.length})</p>
          <ul className="flex max-h-[240px] flex-col gap-3 overflow-y-auto pr-1">
            {selectedItems.map((i) => (
              <li key={i.id} className="flex items-center gap-3">
                <ImageBox src={i.product.image} alt={i.product.name} className="size-12 shrink-0 border border-line" sizes="48px" rounded="rounded-[4px]" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-sm">{i.product.name}</span>
                  <span className="text-xs text-sub tnum">
                    {i.qty} {i.product.unit} × {money(i.price.price)}
                  </span>
                </span>
                <span className="text-sm font-semibold tnum">{money(i.line_total)}</span>
              </li>
            ))}
          </ul>
        </div>
        <CartSummary
          cart={cart}
          deliveryPrice={deliveryPrice}
          action={
            <Button type="submit" full size="lg" loading={busy}>
              Подтвердить заказ
            </Button>
          }
          note="Нажимая «Подтвердить заказ», вы соглашаетесь с условиями продажи и обработкой персональных данных."
        />
      </div>
    </form>
  );
}
