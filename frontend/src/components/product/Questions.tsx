"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Question, QuestionsResponse } from "@/lib/types";
import { client } from "@/lib/client";
import { ApiError } from "@/lib/api";
import { date } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { useMine } from "./useMine";
import { toast } from "@/store/toast";
import { useHydrated } from "@/lib/hooks";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Textarea } from "@/components/ui/Input";
import { ActionChip, SpecialistBadge } from "./Reviews";
import { MoreButton } from "./ProductAccessories";

const PAGE = 5;

/**
 * «Вопросы и ответы» (Figma 8612:423): слева вопрос (автор 16/20 500, дата 14/20 #666, текст 14/21, «Ответить»),
 * справа ответы в плашках 393px #F6F7F8 r10 с «Специалист ТЭК»; разделитель #D9DDE4; справа — «Задать вопрос».
 */
export function Questions({ slug, initial }: { slug: string; initial: QuestionsResponse }) {
  const hydrated = useHydrated();
  const user = useAuth((s) => s.user);
  const router = useRouter();
  const [items, setItems] = useState(initial.items);
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mine, forgetMine] = useMine("questions");

  const remove = async (id: string) => {
    if (!window.confirm("Удалить вопрос?")) return;
    try {
      await client.delete(`/catalog/products/${slug}/questions/${id}`);
      setItems((prev) => prev.filter((q) => q.id !== id));
      forgetMine(id);
      toast.success("Вопрос удалён");
    } catch {
      toast.error("Не удалось удалить вопрос");
    }
  };

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
      router.refresh();
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
    <div className="mt-[23px] grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,856px)_305px] lg:justify-between lg:gap-0">
      <div className="order-2 min-w-0 lg:order-1">
        {items.length > 0 ? (
          <ul>
            {items.slice(0, shown).map((q) => (
              <li key={q.id} className="grid grid-cols-1 gap-4 border-b border-line-3 pb-[27px] last:border-b-0 md:grid-cols-[minmax(0,352px)_393px] md:justify-between md:gap-0 [&+li]:pt-[28px]">
                <div className="md:pt-[15px]">
                  <p className="text-[16px] font-medium leading-[20px] text-black">{q.author}</p>
                  <p className="mt-[4px] text-[14px] leading-[20px] text-sub tnum">{date(q.date)}</p>
                  <p className="mt-[7px] whitespace-pre-line text-[14px] leading-[21px] text-black">{q.text}</p>
                  <div className="mt-[12px] flex gap-[9px]">
                    <ActionChip onClick={() => setOpen(true)}>Ответить</ActionChip>
                    {mine.has(q.id) ? (
                      <ActionChip danger onClick={() => void remove(q.id)}>
                        Удалить
                      </ActionChip>
                    ) : null}
                  </div>
                </div>
                {q.answer ? (
                  <div className="self-start rounded-[10px] bg-surface pb-[18px] pl-[21px] pr-[20px] pt-[15px]">
                    <p className="flex flex-wrap items-center gap-x-[12px] gap-y-1">
                      <span className="text-[16px] font-medium leading-[20px] text-black">{q.answer.author}</span>
                      <SpecialistBadge />
                    </p>
                    <p className="mt-[4px] text-[14px] leading-[20px] text-sub tnum">{date(q.answer.date)}</p>
                    <p className="mt-[7px] whitespace-pre-line text-[14px] leading-[20px] text-black">{q.answer.text}</p>
                  </div>
                ) : (
                  <p className="self-start rounded-[10px] bg-surface px-[21px] py-[15px] text-[14px] leading-[20px] text-sub">Ожидает ответа специалиста</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-[10px] bg-surface p-8 text-center text-[14px] leading-[20px] text-sub">Вопросов пока нет. Задайте первый — ответит специалист ТЭК.</div>
        )}
        {shown < items.length ? <MoreButton className="mx-auto mt-[35px]" onClick={() => setShown((n) => n + PAGE)} /> : null}
      </div>

      <div className="order-1 lg:order-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-[42px] w-full items-center justify-center rounded-[7px] bg-brand text-[15px] font-medium leading-[24px] text-black transition-colors hover:bg-brand-hover lg:w-[251px]"
        >
          Задать вопрос
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Задать вопрос">
        {hydrated && !user ? (
          <div className="text-center">
            <p className="text-[14px] leading-[20px]">Чтобы задать вопрос, войдите в личный кабинет.</p>
            <Link href={`/login?next=/product/${slug}`} className="mt-4 inline-flex h-[42px] items-center rounded-[7px] bg-brand px-6 text-[14px] font-medium hover:bg-brand-hover">
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
