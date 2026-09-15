"use client";

import Link from "next/link";
import { useState } from "react";
import type { Question, QuestionsResponse } from "@/lib/types";
import { client } from "@/lib/client";
import { ApiError } from "@/lib/api";
import { date } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { useHydrated } from "@/lib/hooks";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Textarea } from "@/components/ui/Input";

const PAGE = 5;

export function Questions({ slug, initial }: { slug: string; initial: QuestionsResponse }) {
  const hydrated = useHydrated();
  const user = useAuth((s) => s.user);
  const [items, setItems] = useState(initial.items);
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError("Введите вопрос");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const q = await client.post<Question>(`/catalog/products/${slug}/questions`, { text });
      setItems((prev) => [q, ...prev]);
      setText("");
      setOpen(false);
      toast.success("Вопрос отправлен. Ответим в ближайшее время");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось отправить вопрос");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sub">Задайте вопрос о товаре — ответит специалист ТЭК.</p>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Задать вопрос
        </Button>
      </div>
      {items.length > 0 ? (
        <ul className="rounded-[8px] border border-line bg-white px-5">
          {items.slice(0, shown).map((q) => (
            <li key={q.id} className="border-b border-line py-5 last:border-b-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-base font-semibold">{q.author}</span>
                <span className="text-xs text-sub tnum">{date(q.date)}</span>
              </div>
              <p className="mt-2 text-base">{q.text}</p>
              {q.answer ? (
                <div className="mt-3 rounded-[8px] bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-base font-semibold">{q.answer.author}</span>
                    <span className="text-xs text-sub tnum">{date(q.answer.date)}</span>
                    <span className="rounded-[4px] bg-brand px-1.5 py-0.5 text-[11px] font-semibold">Специалист ТЭК</span>
                  </div>
                  <p className="mt-2 text-base">{q.answer.text}</p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-sub">Ожидает ответа</p>
              )}
              <button type="button" onClick={() => setOpen(true)} className="mt-3 text-sm font-medium text-info hover:underline">
                Ответить
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-[8px] border border-dashed border-line p-8 text-center text-sub">Вопросов пока нет.</div>
      )}
      {shown < items.length ? (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={() => setShown((n) => n + PAGE)}>
            Еще
          </Button>
        </div>
      ) : null}

      <Modal open={open} onClose={() => setOpen(false)} title="Задать вопрос">
        {hydrated && !user ? (
          <div className="text-center">
            <p>Чтобы задать вопрос, войдите в личный кабинет.</p>
            <Link href={`/login?next=/product/${slug}`} className="mt-4 inline-flex h-10 items-center rounded-[6px] bg-brand px-5 font-semibold hover:bg-brand-hover">
              Войти
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Ваш вопрос" htmlFor="q-text" required error={error}>
              <Textarea id="q-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Например: подходит ли для наружной установки?" />
            </Field>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" loading={busy}>
                Отправить
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
