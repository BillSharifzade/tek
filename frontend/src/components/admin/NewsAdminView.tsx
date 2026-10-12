"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { adminApi } from "@/lib/admin-api";
import type { AdminNews, AdminNewsDetail } from "@/lib/admin-types";
import { cn } from "@/lib/cn";
import { date as fmtDate } from "@/lib/format";
import { toast } from "@/store/toast";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, type Column } from "@/components/account/DataTable";
import { Card, CardTitle, EmptyState, btnCls, errorMessage, fieldCls } from "@/components/account/shared";
import { FieldLabel, ImageField, MarkupField, splitList } from "./ContentFields";
import { ConfirmModal, ErrorLine, SearchField, Spinner, useLoad } from "./shared";
import { useQueryState, useSearchText } from "./useQueryState";

const iconBtn = "inline-flex size-[32px] items-center justify-center rounded-[6px] text-sub transition-colors hover:bg-btn hover:text-black";

/** «Новости»: список (поиск, удаление) и переход к редактору. Сайт обновляется в течение пары минут (кэш страниц). */
export function NewsAdminView() {
  const router = useRouter();
  const qs = useQueryState();
  const q = qs.get("q");
  const page = Math.max(1, Number(qs.get("page", "1")) || 1);
  const [text, setText] = useSearchText(qs);
  const list = useLoad(`news:${q}:${page}`, () => adminApi.news({ q, page, per_page: 50 }), "Не удалось загрузить новости");
  const [remove, setRemove] = useState<AdminNews | null>(null);
  const [busy, setBusy] = useState(false);

  const doRemove = async () => {
    if (!remove) return;
    setBusy(true);
    try {
      await adminApi.deleteNews(remove.id);
      toast.success("Новость удалена");
      setRemove(null);
      list.reload();
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось удалить новость"));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<AdminNews>[] = [
    { key: "date", header: "Дата", className: "w-[110px]", cell: (n) => <span className="tnum">{fmtDate(n.published_at)}</span> },
    {
      key: "title",
      header: "Заголовок",
      cell: (n) => (
        <span className="block min-w-[220px]">
          <Link href={`/admin/news/${n.id}`} onClick={(e) => e.stopPropagation()} className="line-clamp-2 font-medium text-black underline decoration-transparent underline-offset-[3px] hover:decoration-black">
            {n.title}
          </Link>
          {n.tags.length ? <span className="block text-[13px] leading-[18px] text-[#555]">{n.tags.join(" · ")}</span> : null}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "w-[52px]",
      cell: (n) => (
        <button
          type="button"
          className={iconBtn}
          onClick={(e) => {
            e.stopPropagation();
            setRemove(n);
          }}
          aria-label={`Удалить: ${n.title}`}
          title="Удалить"
        >
          <Trash2 className="size-4" />
        </button>
      ),
    },
  ];

  const data = list.data;
  return (
    <Card className="min-h-[300px]">
      <CardTitle
        right={
          <span className="flex items-center gap-[12px]">
            {list.loading && data ? <Spinner /> : null}
            <ButtonLink href="/admin/news/new" className={btnCls} icon={<Plus className="size-4" aria-hidden />}>
              Добавить новость
            </ButtonLink>
          </span>
        }
      >
        Новости
      </CardTitle>
      <SearchField value={text} onChange={setText} placeholder="Заголовок" className="mt-[20px] sm:max-w-[360px]" />
      <ErrorLine error={list.error} className="mt-[20px]" />
      <div className="mt-[24px]">
        {data === null ? (
          list.error ? null : <Skeleton className="h-[240px] rounded-[7px]" />
        ) : (
          <DataTable columns={columns} rows={data.items} rowKey={(n) => String(n.id)} onRowClick={(n) => router.push(`/admin/news/${n.id}`)} empty={q ? "Ничего не нашли" : "Новостей пока нет"} />
        )}
      </div>
      {data ? <Pagination page={data.page} pages={data.pages} hrefFor={(p) => qs.hrefFor({ page: p })} className="mt-[24px]" /> : null}
      <ConfirmModal open={remove !== null} title="Удалить новость?" confirmLabel="Удалить" danger busy={busy} onConfirm={doRemove} onClose={() => setRemove(null)}>
        «{remove?.title}» пропадёт с сайта. Это действие нельзя отменить.
      </ConfirmModal>
    </Card>
  );
}

/** Редактор новости (`id` — «new» для новой). */
export function NewsEditView({ id }: { id: string }) {
  const isNew = id === "new";
  const numId = Number(id);
  const item = useLoad(isNew ? null : `news-item:${id}`, () => adminApi.newsItem(numId), "Не удалось загрузить новость");
  if (!isNew && item.data === null) {
    if (item.error) {
      return (
        <Card>
          <CardTitle>Новость</CardTitle>
          {item.status === 404 ? (
            <EmptyState className="mt-[21px]">
              Новость не найдена.{" "}
              <Link href="/admin/news" className="text-black underline underline-offset-[3px]">
                К списку новостей
              </Link>
            </EmptyState>
          ) : (
            <ErrorLine error={item.error} className="mt-[21px]" />
          )}
        </Card>
      );
    }
    return <Skeleton className="h-[520px] rounded-[7px]" />;
  }
  return <NewsForm key={item.data ? `${item.data.id}:${item.data.slug}` : "new"} initial={item.data} />;
}

function NewsForm({ initial }: { initial: AdminNewsDetail | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [published, setPublished] = useState(initial?.published_at ?? new Date().toISOString().slice(0, 10));
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [image, setImage] = useState(initial?.image_url ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [body, setBody] = useState(initial?.body_text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Укажите заголовок");
    setBusy(true);
    try {
      const input = { title: title.trim(), slug: slug.trim() || undefined, published_at: published, excerpt: excerpt.trim(), body_text: body, image_url: image.trim() || null, tags: splitList(tags) };
      const saved = initial ? await adminApi.updateNews(initial.id, input) : await adminApi.createNews(input);
      toast.success(initial ? "Новость сохранена" : "Новость опубликована");
      if (!initial) router.replace(`/admin/news/${saved.id}`);
      else setSlug(saved.slug);
    } catch (err) {
      setError(errorMessage(err, "Не удалось сохранить новость"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-[16px] lg:gap-[27px]">
      <Card>
        <form onSubmit={save} className="flex flex-col gap-[16px]">
          <CardTitle
            right={
              initial ? (
                <Link href={`/news/${initial.slug}`} target="_blank" className="inline-flex items-center gap-[6px] text-[15px] leading-[20px] text-[#555] transition-colors hover:text-black">
                  На сайте <ExternalLink className="size-4" aria-hidden />
                </Link>
              ) : null
            }
          >
            {initial ? "Новость" : "Новая новость"}
          </CardTitle>
          <FieldLabel label="Заголовок" htmlFor="nw-title">
            <Input id="nw-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} className={fieldCls} />
          </FieldLabel>
          <div className="grid grid-cols-1 gap-[16px] md:grid-cols-3">
            <FieldLabel label="Дата" htmlFor="nw-date">
              <Input id="nw-date" type="date" value={published} onChange={(e) => setPublished(e.target.value)} className={fieldCls} />
            </FieldLabel>
            <FieldLabel label="Теги" htmlFor="nw-tags" hint="Через запятую">
              <Input id="nw-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Проекты, Компания" className={fieldCls} />
            </FieldLabel>
            <FieldLabel label="Адрес страницы" htmlFor="nw-slug" hint={initial ? "/news/…" : "Пусто — из заголовка"}>
              <Input id="nw-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="iz-zagolovka" className={fieldCls} />
            </FieldLabel>
          </div>
          <FieldLabel label="Анонс" htmlFor="nw-excerpt" hint="Короткий текст для карточки в списке новостей">
            <Textarea id="nw-excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} maxLength={1000} rows={3} className={cn(fieldCls, "h-auto py-[8px]")} />
          </FieldLabel>
          <ImageField id="nw-image" label="Картинка" value={image} onChange={setImage} />
          <MarkupField id="nw-body" label="Текст новости" value={body} onChange={setBody} />
          <ErrorLine error={error} />
          <div className="flex flex-wrap gap-[10px]">
            <Button type="submit" className={btnCls} loading={busy}>
              {initial ? "Сохранить" : "Опубликовать"}
            </Button>
            <ButtonLink href="/admin/news" variant="outline" className={btnCls} icon={<ArrowLeft className="size-4" aria-hidden />}>
              К списку новостей
            </ButtonLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
