"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MyQuestion, MyReview, ReviewReply } from "@/lib/types";
import { client } from "@/lib/client";
import { date } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Stars } from "@/components/ui/Rating";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { Card, CardTitle, EmptyState, ErrorLine, errorMessage } from "./shared";

type ReviewRow = MyReview & { id?: string; pros?: string | null; cons?: string | null };
type QuestionRow = MyQuestion & { id?: string };
type Tab = "reviews" | "questions";

/**
 * «Отзывы и вопросы» (макета нет — в стиле ЛК): мои отзывы и вопросы о товарах с ответами специалистов ТЭК.
 * Уведомления об ответах — на «Основной информации» и по e-mail (настройка в «Личных данных»).
 */
export function ReviewsView() {
  const [tab, setTab] = useState<Tab>("reviews");
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([client.get<ReviewRow[]>("/account/reviews"), client.get<QuestionRow[]>("/account/questions")])
      .then(([r, q]) => {
        setReviews(r);
        setQuestions(q);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const answered = (questions?.filter((q) => q.answer).length ?? 0) + (reviews?.filter((r) => r.reply).length ?? 0);
  const loading = !error && (tab === "reviews" ? reviews === null : questions === null);

  return (
    <Card>
      <CardTitle right={answered > 0 ? <span className="rounded-[7px] bg-brand-light px-[12px] py-[6px] text-[15px] leading-[20px] text-g333">Получено ответов: {answered}</span> : null}>
        Отзывы и вопросы
      </CardTitle>
      <Tabs<Tab>
        className="mt-[21px]"
        items={[
          { key: "reviews", label: "Отзывы", count: reviews?.length },
          { key: "questions", label: "Вопросы", count: questions?.length },
        ]}
        value={tab}
        onChange={setTab}
      />
      <ErrorLine error={error} className="mt-[20px]" />

      {loading ? (
        <Skeleton className="mt-[20px] h-[160px] rounded-[7px]" />
      ) : tab === "reviews" ? (
        reviews && reviews.length === 0 ? (
          <EmptyState className="mt-[20px]">
            Вы ещё не оставляли отзывов.{" "}
            <Link href="/catalog" className="text-black underline underline-offset-[3px]">
              Перейти в каталог
            </Link>
          </EmptyState>
        ) : reviews ? (
          <ul className="divide-y divide-line">
            {reviews.map((r, i) => (
              <li key={r.id ?? `${r.product.slug}-${i}`} className="py-[20px]">
                <ItemHeader product={r.product} dateValue={r.date} replied={Boolean(r.reply)} />
                <Stars value={r.rating} className="mt-[10px]" />
                {r.pros ? (
                  <p className="mt-[10px] text-[15px] leading-[20px]">
                    <span className="font-medium">Достоинства:</span> {r.pros}
                  </p>
                ) : null}
                {r.cons ? (
                  <p className="mt-[6px] text-[15px] leading-[20px]">
                    <span className="font-medium">Недостатки:</span> {r.cons}
                  </p>
                ) : null}
                <p className="mt-[8px] whitespace-pre-line text-[15px] leading-[20px] text-g333">{r.text}</p>
                {r.reply ? <ReplyBlock reply={r.reply} /> : null}
              </li>
            ))}
          </ul>
        ) : null
      ) : questions && questions.length === 0 ? (
        <EmptyState className="mt-[20px]">Вы ещё не задавали вопросов о товарах.</EmptyState>
      ) : questions ? (
        <ul className="divide-y divide-line">
          {questions.map((q, i) => (
            <li key={q.id ?? `${q.product.slug}-${i}`} className="py-[20px]">
              <ItemHeader product={q.product} dateValue={q.date} replied={Boolean(q.answer)} />
              <p className="mt-[10px] whitespace-pre-line text-[15px] leading-[20px] text-g333">{q.text}</p>
              {q.answer ? <ReplyBlock reply={q.answer} /> : <p className="mt-[10px] text-[13px] leading-[18px] text-muted">Ожидает ответа специалиста ТЭК</p>}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function ItemHeader({ product, dateValue, replied }: { product: { slug: string; name: string }; dateValue: string; replied: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-[8px]">
      <div className="min-w-0">
        <Link href={`/product/${product.slug}`} className="line-clamp-1 text-[15px] font-medium leading-[20px] text-black underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-black">
          {product.name}
        </Link>
        <span className="text-[13px] leading-[18px] text-muted tnum">{date(dateValue)}</span>
      </div>
      {replied ? <span className="inline-flex h-[20px] items-center rounded-[3px] bg-new-bg px-[7px] text-[12px] font-medium leading-[12px] text-new">Есть ответ</span> : null}
    </div>
  );
}

function ReplyBlock({ reply, className }: { reply: ReviewReply; className?: string }) {
  return (
    <div className={cn("mt-[14px] rounded-[7px] bg-surface-2 px-[16px] py-[12px]", className)}>
      <p className="text-[13px] leading-[18px]">
        <span className="font-medium text-black">{reply.author || "Точикэлектрокомплект"}</span>
        <span className="text-muted"> · Специалист ТЭК · {date(reply.date)}</span>
      </p>
      <p className="mt-[4px] whitespace-pre-line text-[15px] leading-[20px] text-g333">{reply.text}</p>
    </div>
  );
}
