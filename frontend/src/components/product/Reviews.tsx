"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Review, ReviewReply, ReviewsResponse } from "@/lib/types";
import { client } from "@/lib/client";
import { ApiError } from "@/lib/api";
import { date } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuth } from "@/store/auth";
import { useMine } from "./useMine";
import { toast } from "@/store/toast";
import { useHydrated } from "@/lib/hooks";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Star, Stars, pluralReviews } from "@/components/ui/Rating";
import { MoreButton } from "./ProductAccessories";

/** Отзыв может прийти с фото (поле появится в API) — показываем миниатюры 88×88. */
type ReviewItemT = Review & { photos?: string[] };

/** Серые кнопки-действия 24px (Figma «Ответить» #EEF0F2 / «Удалить» #FDE9E8), 13/20 — строка по центру (2px сверху). */
export function ActionChip({ children, onClick, danger, className }: { children: React.ReactNode; onClick: () => void; danger?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[24px] items-center rounded-[5px] px-[8px] text-[13px] leading-[20px] transition-colors",
        danger ? "bg-[#FDE9E8] text-sale hover:bg-[#fbd8d6]" : "bg-btn text-g333 hover:bg-btn-hover",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Плашка «Специалист ТЭК»: 21px, #FFCC33, r4, 13/15. */
export function SpecialistBadge({ className }: { className?: string }) {
  return <span className={cn("inline-flex h-[21px] shrink-0 items-center rounded-[4px] bg-brand px-[5px] text-[13px] leading-[15px] text-black", className)}>Специалист ТЭК</span>;
}

/** Отвечать на отзывы и вопросы и удалять любые из них могут только сотрудники ТЭК (администратор, менеджер). */
export function useStaff(): boolean {
  const hydrated = useHydrated();
  const role = useAuth((s) => s.user?.role);
  return hydrated && (role === "admin" || role === "manager");
}

/** Ответ сотрудника прямо под отзывом / вопросом (доработки R5: «Ответить» отвечает, а не открывает форму нового отзыва). */
export function ReplyForm({ label, onSubmit, onCancel, className }: { label: string; onSubmit: (text: string) => Promise<boolean>; onCancel: () => void; className?: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError("Напишите ответ");
      return;
    }
    setBusy(true);
    setError(null);
    if (!(await onSubmit(text.trim()))) setBusy(false);
  };
  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-[10px]", className)}>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Ответ от имени ТЭК" aria-label={label} invalid={Boolean(error)} autoFocus className="min-h-[88px]" />
      {error ? (
        <p className="text-[13px] leading-[17px] text-sale" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-[9px]">
        <Button type="submit" size="sm" loading={busy}>
          Ответить
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

function ReviewItem({
  r,
  staff,
  onDelete,
  onReply,
  onDeleteReply,
}: {
  r: ReviewItemT;
  staff: boolean;
  onDelete?: () => void;
  onReply: (text: string) => Promise<boolean>;
  onDeleteReply: () => void;
}) {
  const photos = r.photos ?? [];
  const [replying, setReplying] = useState(false);
  return (
    <li className="border-b border-line-3 pb-[23px] pt-0 last:border-b-0 last:pb-0 [&+li]:pt-[22px]">
      <div className="flex flex-col gap-4 md:flex-row md:gap-0">
        <div className="md:w-[224px] md:shrink-0">
          <Stars value={r.rating} size={14.6} step={15.6} className="mt-[4px] flex" />
          <p className="mt-[11px] text-[16px] font-semibold leading-[20px] text-black">{r.author}</p>
          <p className="mt-[3px] text-[14px] leading-[20px] text-sub tnum">{date(r.date)}</p>
          {photos.length > 0 ? (
            <ul className="mt-[24px] flex gap-[8px]">
              {photos.slice(0, 2).map((src) => (
                <li key={src} className="relative size-[88px] overflow-hidden rounded-[5px] bg-[#D9D9D9]">
                  <Image src={src} alt="" fill sizes="88px" className="object-cover" />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="relative min-w-0 flex-1">
          {onDelete || (staff && !r.reply) ? (
            <div className="flex justify-end gap-[9px] md:absolute md:right-0 md:top-0">
              {onDelete ? (
                <ActionChip danger onClick={onDelete}>
                  Удалить
                </ActionChip>
              ) : null}
              {staff && !r.reply ? <ActionChip onClick={() => setReplying((v) => !v)}>Ответить</ActionChip> : null}
            </div>
          ) : null}
          <div className="flex flex-col gap-[8px] text-[14px] leading-[22px] text-black md:mt-[28px] md:pr-0">
            {r.pros ? (
              <p>
                <b className="font-bold">Достоинства:</b> {r.pros}
              </p>
            ) : null}
            {r.cons ? (
              <p>
                <b className="font-bold">Недостатки:</b> {r.cons}
              </p>
            ) : null}
            {r.text ? <p className="whitespace-pre-line">{r.text}</p> : null}
          </div>
          {replying && !r.reply ? (
            <ReplyForm
              label="Ответ на отзыв"
              className="mt-[21px] border-t border-line-3 pl-[22px] pt-[17px]"
              onCancel={() => setReplying(false)}
              onSubmit={async (text) => {
                const ok = await onReply(text);
                if (ok) setReplying(false);
                return ok;
              }}
            />
          ) : null}
          {r.reply ? (
            <div className="relative mt-[21px] border-t border-line-3 pl-[22px] pt-[17px]">
              {staff ? (
                <ActionChip danger onClick={onDeleteReply} className="absolute right-0 top-[16px]">
                  Удалить
                </ActionChip>
              ) : null}
              <p className="flex flex-wrap items-start gap-x-[11px] gap-y-1 pr-[90px]">
                <span className="text-[16px] font-semibold leading-[20px] text-black">{r.reply.author}</span>
                <SpecialistBadge />
              </p>
              <p className="mt-[2px] text-[14px] leading-[20px] text-sub tnum">{date(r.reply.date)}</p>
              <p className="mt-[10px] whitespace-pre-line text-[14px] leading-[20px] text-black">{r.reply.text}</p>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/**
 * «Отзывы» (Figma 8612:346): слева список (звёзды 14.6, автор 16/20 600, дата 14/20 #666, фото 88×88;
 * справа Достоинства/Недостатки/текст 14px, «Ответить», ответ «Специалист ТЭК» под линией),
 * справа — сводка 305×347: средняя 32px, звёзды 17px, распределение по оценкам и «Оставить отзыв».
 */
export function Reviews({ slug, initial }: { slug: string; initial: ReviewsResponse }) {
  const hydrated = useHydrated();
  const user = useAuth((s) => s.user);
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [items, setItems] = useState<ReviewItemT[]>(initial.items);
  const [page, setPage] = useState(initial.page);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<number | null>(null);
  const mine = useMine("reviews");
  const staff = useStaff();
  const reviewed = mine.products.has(slug);

  const remove = async (id: string) => {
    if (!window.confirm("Удалить отзыв?")) return;
    try {
      // сотрудник удаляет любой отзыв через панель, автор — свой
      await client.delete(staff ? `/admin/reviews/${id}` : `/catalog/products/${slug}/reviews/${id}`);
      const removed = items.find((r) => r.id === id);
      setItems((prev) => prev.filter((r) => r.id !== id));
      mine.forget(id);
      if (removed) {
        setData((d) => {
          const distribution = { ...d.summary.distribution, [removed.rating]: Math.max(0, (d.summary.distribution[removed.rating] ?? 1) - 1) };
          const count = Math.max(0, d.summary.count - 1);
          const sum = Object.entries(distribution).reduce((a, [k, v]) => a + Number(k) * Number(v), 0);
          return { ...d, summary: { avg: count ? Math.round((sum / count) * 10) / 10 : 0, count, distribution } };
        });
      }
      toast.success("Отзыв удалён");
      router.refresh();
    } catch {
      toast.error("Не удалось удалить отзыв");
    }
  };

  const setReply = (id: string, reply: ReviewReply | null) => setItems((prev) => prev.map((r) => (r.id === id ? { ...r, reply } : r)));

  const reply = async (id: string, text: string) => {
    try {
      const r = await client.post<{ reply?: ReviewReply }>(`/admin/reviews/${id}/reply`, { text });
      setReply(id, r.reply ?? { author: "Точикэлектрокомплект", date: new Date().toISOString(), text });
      toast.success("Ответ опубликован");
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось отправить ответ");
      return false;
    }
  };

  const removeReply = async (id: string) => {
    if (!window.confirm("Удалить ответ ТЭК?")) return;
    try {
      await client.delete(`/admin/reviews/${id}/reply`);
      setReply(id, null);
      toast.success("Ответ удалён");
    } catch {
      toast.error("Не удалось удалить ответ");
    }
  };

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
  const list = filter ? items.filter((r) => r.rating === filter) : items;

  return (
    <div className="mt-[32px] grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,856px)_305px] lg:justify-between lg:gap-0">
      <div className="order-2 min-w-0 lg:order-1">
        {list.length > 0 ? (
          <ul>
            {list.map((r) => (
              <ReviewItem
                key={r.id}
                r={r}
                staff={staff}
                onDelete={staff || mine.ids.has(r.id) ? () => void remove(r.id) : undefined}
                onReply={(text) => reply(r.id, text)}
                onDeleteReply={() => void removeReply(r.id)}
              />
            ))}
          </ul>
        ) : (
          <div className="rounded-[10px] bg-surface p-8 text-center text-[14px] leading-[20px] text-sub">
            {filter ? "Нет отзывов с такой оценкой среди загруженных." : "Отзывов пока нет. Станьте первым!"}
          </div>
        )}
        {page < data.pages ? <MoreButton className="mx-auto mt-[25px]" onClick={loadMore} loading={loadingMore} /> : null}
      </div>

      <aside className="order-1 self-start rounded-[10px] bg-white px-[26px] pb-[28px] pt-[21px] shadow-pop lg:order-2 lg:pr-[28px]">
        <p className="text-[32px] font-semibold leading-[32px] text-black tnum">{data.summary.avg.toFixed(1)}</p>
        <div className="mt-[17px] flex h-[17px] items-center justify-between">
          <Stars value={data.summary.avg} size={17} step={21.4} />
          <span className="text-[14px] leading-[15px] text-sub">
            {total} {pluralReviews(total)}
          </span>
        </div>
        <div className="mt-[21px] border-t border-line" />
        <ul className="mt-[19px] flex flex-col gap-[12px]">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = Number(dist[String(n)] ?? 0);
            const on = filter === n;
            return (
              <li key={n} className="flex h-[15px] items-center justify-between">
                <span className="flex items-center gap-[2.9px]" aria-label={`${n} из 5`}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} size={11.1} fill={i <= n ? 1 : 0} />
                  ))}
                </span>
                <button
                  type="button"
                  disabled={c === 0}
                  onClick={() => setFilter(on ? null : n)}
                  aria-pressed={on}
                  className={cn("text-[14px] leading-[15px] link-hover disabled:cursor-default disabled:text-muted", on ? "font-medium text-black" : "text-link")}
                >
                  {c} {pluralReviews(c)}
                </button>
              </li>
            );
          })}
        </ul>
        {/* один отзыв на товар от аккаунта (доработки R5) */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={reviewed}
          className="mt-[26px] flex h-[42px] w-full items-center justify-center rounded-[7px] bg-brand text-[15px] font-medium leading-[24px] text-black transition-colors hover:bg-brand-hover disabled:cursor-default disabled:bg-btn disabled:text-sub"
        >
          {reviewed ? "Вы уже оставили отзыв" : "Оставить отзыв"}
        </button>
        {hydrated && !user ? (
          <p className="mt-[8px] text-center text-[12px] leading-[15px] text-muted">
            Для отзыва нужно{" "}
            <Link href={`/login?next=/product/${slug}`} className="text-link link-hover">
              войти
            </Link>
          </p>
        ) : null}
      </aside>

      <ReviewModal
        open={open}
        onClose={() => setOpen(false)}
        slug={slug}
        onCreated={(r) => {
          setItems((prev) => [r, ...prev]);
          mine.add(r.id, slug);
          setData((d) => {
            const distribution = { ...d.summary.distribution, [r.rating]: (d.summary.distribution[r.rating] ?? 0) + 1 };
            const count = d.summary.count + 1;
            const sum = Object.entries(distribution).reduce((a, [k, v]) => a + Number(k) * Number(v), 0);
            return { ...d, summary: { avg: Math.round((sum / count) * 10) / 10, count, distribution } };
          });
          // счётчики во вкладках и рейтинг в шапке товара — серверные: перерисовываем страницу
          router.refresh();
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
          <p className="text-[14px] leading-[20px]">Чтобы оставить отзыв, войдите в личный кабинет.</p>
          <Link href={`/login?next=/product/${slug}`} className="mt-4 inline-flex h-[42px] items-center rounded-[7px] bg-brand px-6 text-[14px] font-medium hover:bg-brand-hover">
            Войти
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-[14px] leading-[15px] text-sub">Ваша оценка</p>
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
                  <Star size={26} fill={(hover || rating) >= n ? 1 : 0} />
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
