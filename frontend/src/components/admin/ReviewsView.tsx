"use client";

import Link from "next/link";
import { ExternalLink, Trash2 } from "lucide-react";
import { useState } from "react";
import { adminApi } from "@/lib/admin-api";
import type { AdminPaged, AdminQuestion, AdminReview } from "@/lib/admin-types";
import { cn } from "@/lib/cn";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Textarea } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Stars } from "@/components/ui/Rating";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { Card, CardTitle, EmptyState, btnCls, errorMessage, fieldCls } from "@/components/account/shared";
import { ConfirmModal, ErrorLine, Spinner, Tag, dateTime, useLoad } from "./shared";
import { useQueryState } from "./useQueryState";

type Tab = "reviews" | "questions";

/** у каждой записи — поле ответа, поэтому страница короче, чем в таблицах */
const PER_PAGE = 20;

/** Общая форма записи для обеих вкладок. */
interface Entry {
  id: string;
  product: AdminReview["product"];
  author: string;
  created_at: string;
  rating?: number;
  pros?: string | null;
  cons?: string | null;
  text: string;
  reply: string | null;
  replied_at: string | null;
  status?: string;
}

const fromReview = (r: AdminReview): Entry => ({ ...r, reply: r.reply_text, replied_at: r.replied_at });
const fromQuestion = (q: AdminQuestion): Entry => ({ ...q, reply: q.answer_text, replied_at: q.answered_at });

/** «Отзывы и вопросы» о товарах: сначала — без ответа; ответ магазина, удаление (с подтверждением), ссылка на товар. */
export function ReviewsView() {
  const qs = useQueryState();
  const tab: Tab = qs.get("tab") === "questions" ? "questions" : "reviews";
  const unanswered = qs.get("all") !== "1";
  const page = Math.max(1, Number(qs.get("page", "1")) || 1);

  const list = useLoad<AdminPaged<Entry>>(
    `${tab}:${unanswered}:${page}`,
    () =>
      tab === "reviews"
        ? adminApi.reviews({ unanswered, page, per_page: PER_PAGE }).then((r) => ({ ...r, items: r.items.map(fromReview) }))
        : adminApi.questions({ unanswered, page, per_page: PER_PAGE }).then((r) => ({ ...r, items: r.items.map(fromQuestion) })),
    tab === "reviews" ? "Не удалось загрузить отзывы" : "Не удалось загрузить вопросы",
  );
  const counts = useLoad("rq-counts", () => Promise.all([adminApi.reviews({ unanswered: true, per_page: 1 }), adminApi.questions({ unanswered: true, per_page: 1 })]).then(([r, q]) => ({ reviews: r.total, questions: q.total })));

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Entry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const noun = tab === "reviews" ? "отзыв" : "вопрос";

  const reply = async (e: Entry) => {
    const text = (drafts[e.id] ?? e.reply ?? "").trim();
    if (!text) {
      toast.error("Напишите ответ");
      return;
    }
    setSavingId(e.id);
    try {
      if (tab === "reviews") await adminApi.replyReview(e.id, text);
      else await adminApi.answerQuestion(e.id, text);
      list.mutate((d) => ({ ...d, items: d.items.map((x) => (x.id === e.id ? { ...x, reply: text, replied_at: new Date().toISOString() } : x)) }));
      setEditing(null);
      setDrafts((d) => {
        const next = { ...d };
        delete next[e.id];
        return next;
      });
      toast.success(e.reply ? "Ответ обновлён" : "Ответ опубликован");
      counts.reload();
    } catch (err) {
      toast.error(errorMessage(err, "Не удалось сохранить ответ"));
    } finally {
      setSavingId(null);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      if (tab === "reviews") await adminApi.deleteReview(toDelete.id);
      else await adminApi.deleteQuestion(toDelete.id);
      list.mutate((d) => ({ ...d, total: Math.max(0, d.total - 1), items: d.items.filter((x) => x.id !== toDelete.id) }));
      toast.info(tab === "reviews" ? "Отзыв удалён" : "Вопрос удалён");
      setToDelete(null);
      counts.reload();
    } catch (err) {
      toast.error(errorMessage(err, "Не удалось удалить"));
    } finally {
      setDeleting(false);
    }
  };

  const data = list.data;
  return (
    <Card className="min-h-[347px]">
      <CardTitle right={list.loading && data ? <Spinner /> : null}>Отзывы и вопросы</CardTitle>
      <div className="mt-[18px] flex flex-wrap items-end justify-between gap-x-[20px] gap-y-[12px]">
        <Tabs<Tab>
          className="min-w-0 flex-1"
          value={tab}
          onChange={(t) => qs.set({ tab: t === "reviews" ? null : t })}
          items={[
            { key: "reviews", label: "Отзывы", count: counts.data?.reviews },
            { key: "questions", label: "Вопросы", count: counts.data?.questions },
          ]}
        />
        <Checkbox checked={unanswered} onChange={(e) => qs.set({ all: e.target.checked ? null : 1 })} label="Только без ответа" labelClassName="text-[15px]" className="mb-[10px]" />
      </div>
      <ErrorLine error={list.error} className="mt-[20px]" />

      {data === null ? (
        list.error ? null : <Skeleton className="mt-[24px] h-[280px] rounded-[7px]" />
      ) : data.items.length === 0 ? (
        <EmptyState className="mt-[24px]">{unanswered ? `Все ${tab === "reviews" ? "отзывы" : "вопросы"} с ответом магазина` : `${tab === "reviews" ? "Отзывов" : "Вопросов"} пока нет`}</EmptyState>
      ) : (
        <ul className="mt-[8px] divide-y divide-line">
          {data.items.map((e) => {
            const open = !e.reply || editing === e.id;
            return (
              <li key={e.id} className="py-[20px]">
                <div className="flex flex-wrap items-center gap-x-[12px] gap-y-[4px]">
                  <Link href={`/product/${e.product.slug}`} target="_blank" className="inline-flex min-w-0 items-center gap-[6px] text-[15px] font-semibold leading-[20px] text-black underline decoration-transparent underline-offset-[3px] hover:decoration-black">
                    <span className="truncate">{e.product.name}</span>
                    <ExternalLink className="size-[14px] shrink-0 text-muted" aria-hidden />
                  </Link>
                  {!e.reply ? <Tag tone="yellow">без ответа</Tag> : null}
                  {e.status && e.status !== "published" ? <Tag tone="red">не опубликован</Tag> : null}
                  <button
                    type="button"
                    onClick={() => setToDelete(e)}
                    className="ml-auto inline-flex size-[32px] items-center justify-center rounded-[6px] text-sub transition-colors hover:bg-sale-bg hover:text-sale-text"
                    aria-label={`Удалить ${noun}`}
                    title={`Удалить ${noun}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <p className="mt-[4px] flex flex-wrap items-center gap-x-[10px] text-[13px] leading-[18px] text-[#555]">
                  <span className="font-medium text-black">{e.author}</span>
                  <span className="tnum">{dateTime(e.created_at)}</span>
                  {e.rating !== undefined ? <Stars value={e.rating} size={13} /> : null}
                </p>
                <div className="mt-[8px] flex flex-col gap-[4px] text-[15px] leading-[21px]">
                  {e.pros ? (
                    <p>
                      <span className="font-medium">Достоинства: </span>
                      {e.pros}
                    </p>
                  ) : null}
                  {e.cons ? (
                    <p>
                      <span className="font-medium">Недостатки: </span>
                      {e.cons}
                    </p>
                  ) : null}
                  {e.text ? <p className="whitespace-pre-line">{e.text}</p> : null}
                </div>

                {e.reply && !open ? (
                  <div className="mt-[12px] rounded-[7px] bg-surface-2 px-[16px] py-[12px]">
                    <p className="flex flex-wrap items-center gap-x-[10px] text-[13px] leading-[18px] text-[#555]">
                      <span className="font-medium text-black">Ответ магазина</span>
                      {e.replied_at ? <span className="tnum">{dateTime(e.replied_at)}</span> : null}
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(e.id);
                          setDrafts((d) => ({ ...d, [e.id]: e.reply ?? "" }));
                        }}
                        className="ml-auto text-[13px] text-[#555] underline underline-offset-[3px] hover:text-black"
                      >
                        Изменить
                      </button>
                    </p>
                    <p className="mt-[4px] whitespace-pre-line text-[15px] leading-[21px]">{e.reply}</p>
                  </div>
                ) : (
                  <div className="mt-[12px]">
                    <Textarea
                      value={drafts[e.id] ?? e.reply ?? ""}
                      onChange={(ev) => setDrafts((d) => ({ ...d, [e.id]: ev.target.value }))}
                      placeholder={tab === "reviews" ? "Ответ магазина на отзыв" : "Ответ на вопрос покупателя"}
                      aria-label="Ответ"
                      maxLength={4000}
                      className={cn(fieldCls, "h-auto min-h-[72px] py-[8px]")}
                    />
                    <div className="mt-[8px] flex flex-wrap gap-[8px]">
                      <Button className={btnCls} loading={savingId === e.id} onClick={() => reply(e)}>
                        {e.reply ? "Сохранить ответ" : "Ответить"}
                      </Button>
                      {e.reply ? (
                        <Button variant="outline" className={btnCls} onClick={() => setEditing(null)}>
                          Отмена
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {data ? <Pagination page={data.page} pages={data.pages} hrefFor={(p) => qs.hrefFor({ page: p })} className="mt-[16px]" /> : null}

      <ConfirmModal
        open={toDelete !== null}
        title={tab === "reviews" ? "Удалить отзыв?" : "Удалить вопрос?"}
        confirmLabel="Удалить"
        danger
        busy={deleting}
        onConfirm={remove}
        onClose={() => setToDelete(null)}
      >
        {toDelete ? (
          <>
            {tab === "reviews" ? "Отзыв" : "Вопрос"} покупателя «{toDelete.author}» о товаре «{toDelete.product.name}» будет удалён с сайта вместе с ответом магазина. Это действие нельзя отменить.
          </>
        ) : null}
      </ConfirmModal>
    </Card>
  );
}
