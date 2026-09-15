"use client";

import Link from "next/link";
import { MessageSquareReply } from "lucide-react";
import { useEffect, useState } from "react";
import type { MyQuestion, MyReview, ReviewReply } from "@/lib/types";
import { client } from "@/lib/client";
import { date } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Stars } from "@/components/ui/Rating";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState, ErrorLine, PageTitle, errorMessage } from "./shared";

type ReviewRow = MyReview & { id?: string; pros?: string | null; cons?: string | null };
type QuestionRow = MyQuestion & { id?: string };
type Tab = "reviews" | "questions";

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

  return (
    <div className="flex flex-col gap-5">
      <PageTitle right={answered > 0 ? <span className="rounded-full bg-brand-light px-3 py-1 text-sm font-medium">Получено ответов: {answered}</span> : null}>Отзывы и вопросы</PageTitle>
      <Tabs<Tab>
        items={[
          { key: "reviews", label: "Отзывы", count: reviews?.length },
          { key: "questions", label: "Вопросы", count: questions?.length },
        ]}
        value={tab}
        onChange={setTab}
      />
      <ErrorLine error={error} />

      {tab === "reviews" ? (
        reviews === null ? (
          <Skeleton className="h-48" />
        ) : reviews.length === 0 ? (
          <EmptyState>
            Вы ещё не оставляли отзывов.{" "}
            <Link href="/catalog" className="text-info hover:underline">
              Перейти в каталог
            </Link>
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-4">
            {reviews.map((r, i) => (
              <li key={r.id ?? `${r.product.slug}-${i}`} className="rounded-[8px] border border-line bg-white p-5">
                <ItemHeader product={r.product} dateValue={r.date} replied={Boolean(r.reply)} />
                <Stars value={r.rating} size={16} className="mt-2" />
                {r.pros ? (
                  <p className="mt-3 text-base">
                    <span className="font-semibold">Достоинства:</span> {r.pros}
                  </p>
                ) : null}
                {r.cons ? (
                  <p className="mt-1 text-base">
                    <span className="font-semibold">Недостатки:</span> {r.cons}
                  </p>
                ) : null}
                <p className="mt-2 whitespace-pre-line text-base">{r.text}</p>
                {r.reply ? <ReplyBlock reply={r.reply} /> : null}
              </li>
            ))}
          </ul>
        )
      ) : questions === null ? (
        <Skeleton className="h-48" />
      ) : questions.length === 0 ? (
        <EmptyState>Вы ещё не задавали вопросов о товарах.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-4">
          {questions.map((q, i) => (
            <li key={q.id ?? `${q.product.slug}-${i}`} className="rounded-[8px] border border-line bg-white p-5">
              <ItemHeader product={q.product} dateValue={q.date} replied={Boolean(q.answer)} />
              <p className="mt-3 whitespace-pre-line text-base">{q.text}</p>
              {q.answer ? <ReplyBlock reply={q.answer} /> : <p className="mt-3 text-sm text-sub">Ожидает ответа специалиста ТЭК</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemHeader({ product, dateValue, replied }: { product: { slug: string; name: string }; dateValue: string; replied: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <Link href={`/product/${product.slug}`} className="line-clamp-1 text-base font-semibold hover:text-brand-hover">
          {product.name}
        </Link>
        <span className="text-sm text-sub tnum">{date(dateValue)}</span>
      </div>
      {replied ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-semibold">
          <MessageSquareReply className="size-3.5" aria-hidden />
          Есть ответ
        </span>
      ) : null}
    </div>
  );
}

function ReplyBlock({ reply, className }: { reply: ReviewReply; className?: string }) {
  return (
    <div className={cn("mt-4 rounded-[6px] border-l-[3px] border-brand bg-brand-light px-4 py-3", className)}>
      <p className="text-sm">
        <span className="font-semibold">{reply.author || "Точикэлектрокомплект"}</span>
        <span className="text-sub"> · Специалист ТЭК · {date(reply.date)}</span>
      </p>
      <p className="mt-1 whitespace-pre-line text-base">{reply.text}</p>
    </div>
  );
}
