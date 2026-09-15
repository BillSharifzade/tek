"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { useState } from "react";
import type { Review, ReviewsResponse } from "@/lib/types";
import { client } from "@/lib/client";
import { ApiError } from "@/lib/api";
import { date } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { useHydrated } from "@/lib/hooks";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Stars, pluralReviews } from "@/components/ui/Rating";

function ReviewItem({ r, onReply }: { r: Review; onReply: () => void }) {
  return (
    <li className="border-b border-line py-6 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-light text-base font-semibold">{r.author.slice(0, 1)}</span>
          <div>
            <p className="text-base font-semibold">{r.author}</p>
            <p className="text-xs text-sub tnum">{date(r.date)}</p>
          </div>
        </div>
        <Stars value={r.rating} size={16} />
      </div>
      <div className="mt-4 flex flex-col gap-2 text-base">
        {r.pros ? (
          <p>
            <span className="font-semibold">Достоинства:</span> {r.pros}
          </p>
        ) : null}
        {r.cons ? (
          <p>
            <span className="font-semibold">Недостатки:</span> {r.cons}
          </p>
        ) : null}
        {r.text ? <p className="text-ink/90">{r.text}</p> : null}
      </div>
      <button type="button" onClick={onReply} className="mt-3 text-sm font-medium text-info hover:underline">
        Ответить
      </button>
      {r.reply ? (
        <div className="mt-4 rounded-[8px] bg-surface p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-base font-semibold">{r.reply.author}</span>
            <span className="text-xs text-sub tnum">{date(r.reply.date)}</span>
            <span className="rounded-[4px] bg-brand px-1.5 py-0.5 text-[11px] font-semibold">Специалист ТЭК</span>
          </div>
          <p className="mt-2 text-base">{r.reply.text}</p>
        </div>
      ) : null}
    </li>
  );
}

export function Reviews({ slug, initial }: { slug: string; initial: ReviewsResponse }) {
  const hydrated = useHydrated();
  const user = useAuth((s) => s.user);
  const [data, setData] = useState(initial);
  const [items, setItems] = useState(initial.items);
  const [page, setPage] = useState(initial.page);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState(false);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = await client.get<ReviewsResponse>(`/catalog/products/${slug}/reviews`, { page: page + 1 });
      setItems((prev) => [...prev, ...next.items]);
      setPage(next.page);
    } catch {
      toast.error("Не удалось загрузить отзывы");
    } finally {
      setLoadingMore(false);
    }
  };

  const dist = data.summary.distribution ?? {};
  const total = data.summary.count || 0;

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px_1fr]">
        <div className="rounded-[8px] border border-line bg-white p-5">
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold leading-none tnum">{data.summary.avg.toFixed(1).replace(".", ",")}</span>
            <div>
              <Stars value={data.summary.avg} size={16} />
              <p className="mt-1 text-sm text-sub">
                {total} {pluralReviews(total)}
              </p>
            </div>
          </div>
          <ul className="mt-4 flex flex-col gap-1.5">
            {[5, 4, 3, 2, 1].map((n) => {
              const c = dist[String(n)] ?? 0;
              const pct = total ? Math.round((c / total) * 100) : 0;
              return (
                <li key={n} className="flex items-center gap-2 text-xs text-sub">
                  <span className="flex w-5 items-center gap-0.5 tnum">
                    {n}
                    <Star className="size-3 text-brand" fill="currentColor" strokeWidth={0} />
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-6 text-right tnum">{c}</span>
                </li>
              );
            })}
          </ul>
          <Button className="mt-5" full onClick={() => setOpen(true)}>
            Оставить отзыв
          </Button>
          {hydrated && !user ? (
            <p className="mt-2 text-center text-xs text-sub">
              Для отзыва нужно{" "}
              <Link href={`/login?next=/product/${slug}`} className="text-info hover:underline">
                войти
              </Link>
            </p>
          ) : null}
        </div>
        <div>
          {items.length > 0 ? (
            <ul className="rounded-[8px] border border-line bg-white px-5">
              {items.map((r) => (
                <ReviewItem key={r.id} r={r} onReply={() => setOpen(true)} />
              ))}
            </ul>
          ) : (
            <div className="rounded-[8px] border border-dashed border-line p-8 text-center text-sub">Отзывов пока нет. Станьте первым!</div>
          )}
          {page < data.pages ? (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                Еще
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      <ReviewModal
        open={open}
        onClose={() => setOpen(false)}
        slug={slug}
        onCreated={(r) => {
          setItems((prev) => [r, ...prev]);
          setData((d) => ({ ...d, summary: { ...d.summary, count: d.summary.count + 1 } }));
        }}
      />
    </div>
  );
}

function ReviewModal({ open, onClose, slug, onCreated }: { open: boolean; onClose: () => void; slug: string; onCreated: (r: Review) => void }) {
  const hydrated = useHydrated();
  const user = useAuth((s) => s.user);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!text.trim()) {
      setError("Напишите текст отзыва");
      return;
    }
    setBusy(true);
    try {
      const r = await client.post<Review>(`/catalog/products/${slug}/reviews`, { rating, pros, cons, text });
      onCreated(r);
      toast.success("Спасибо! Отзыв отправлен");
      setPros("");
      setCons("");
      setText("");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось отправить отзыв");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Оставить отзыв">
      {hydrated && !user ? (
        <div className="text-center">
          <p className="text-base">Чтобы оставить отзыв, войдите в личный кабинет.</p>
          <Link href={`/login?next=/product/${slug}`} className="mt-4 inline-flex h-10 items-center rounded-[6px] bg-brand px-5 font-semibold hover:bg-brand-hover">
            Войти
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm text-sub">Ваша оценка</p>
            <div className="flex gap-1" role="radiogroup" aria-label="Оценка">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} из 5`}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(n)}
                  className="p-0.5"
                >
                  <Star className={cn("size-7 transition-colors", (hover || rating) >= n ? "text-brand" : "text-line")} fill="currentColor" strokeWidth={0} />
                </button>
              ))}
            </div>
          </div>
          <Field label="Достоинства" htmlFor="rv-pros">
            <Input id="rv-pros" value={pros} onChange={(e) => setPros(e.target.value)} placeholder="Что понравилось" />
          </Field>
          <Field label="Недостатки" htmlFor="rv-cons">
            <Input id="rv-cons" value={cons} onChange={(e) => setCons(e.target.value)} placeholder="Что можно улучшить" />
          </Field>
          <Field label="Комментарий" htmlFor="rv-text" required error={error}>
            <Textarea id="rv-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Расскажите о вашем опыте использования" />
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" loading={busy}>
              Отправить
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
