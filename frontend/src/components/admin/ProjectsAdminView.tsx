"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { adminApi } from "@/lib/admin-api";
import type { AdminProject, AdminProjectDetail } from "@/lib/admin-types";
import { cn } from "@/lib/cn";
import { date as fmtDate } from "@/lib/format";
import { toast } from "@/store/toast";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input, Textarea } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, type Column } from "@/components/account/DataTable";
import { Card, CardTitle, EmptyState, btnCls, errorMessage, fieldCls, labelCls } from "@/components/account/shared";
import { FieldLabel, ImageField, MarkupField, splitList } from "./ContentFields";
import { ConfirmModal, ErrorLine, SearchField, Spinner, useLoad } from "./shared";
import { useQueryState, useSearchText } from "./useQueryState";

const iconBtn = "inline-flex size-[32px] items-center justify-center rounded-[6px] text-sub transition-colors hover:bg-btn hover:text-black";

/** «Проекты»: список выполненных объектов и переход к редактору. */
export function ProjectsAdminView() {
  const router = useRouter();
  const qs = useQueryState();
  const q = qs.get("q");
  const page = Math.max(1, Number(qs.get("page", "1")) || 1);
  const [text, setText] = useSearchText(qs);
  const list = useLoad(`projects:${q}:${page}`, () => adminApi.projects({ q, page, per_page: 50 }), "Не удалось загрузить проекты");
  const [remove, setRemove] = useState<AdminProject | null>(null);
  const [busy, setBusy] = useState(false);

  const doRemove = async () => {
    if (!remove) return;
    setBusy(true);
    try {
      await adminApi.deleteProject(remove.id);
      toast.success("Проект удалён");
      setRemove(null);
      list.reload();
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось удалить проект"));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<AdminProject>[] = [
    { key: "date", header: "Дата", className: "w-[110px]", cell: (p) => <span className="tnum">{fmtDate(p.project_date)}</span> },
    {
      key: "title",
      header: "Проект",
      cell: (p) => (
        <span className="block min-w-[220px]">
          <Link href={`/admin/projects/${p.id}`} onClick={(e) => e.stopPropagation()} className="line-clamp-2 font-medium text-black underline decoration-transparent underline-offset-[3px] hover:decoration-black">
            {p.title}
          </Link>
          <span className="block text-[13px] leading-[18px] text-[#555]">{[p.object, p.service].filter(Boolean).join(" · ")}</span>
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "w-[52px]",
      cell: (p) => (
        <button
          type="button"
          className={iconBtn}
          onClick={(e) => {
            e.stopPropagation();
            setRemove(p);
          }}
          aria-label={`Удалить: ${p.title}`}
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
            <ButtonLink href="/admin/projects/new" className={btnCls} icon={<Plus className="size-4" aria-hidden />}>
              Добавить проект
            </ButtonLink>
          </span>
        }
      >
        Проекты
      </CardTitle>
      <SearchField value={text} onChange={setText} placeholder="Название или объект" className="mt-[20px] sm:max-w-[360px]" />
      <ErrorLine error={list.error} className="mt-[20px]" />
      <div className="mt-[24px]">
        {data === null ? (
          list.error ? null : <Skeleton className="h-[240px] rounded-[7px]" />
        ) : (
          <DataTable columns={columns} rows={data.items} rowKey={(p) => String(p.id)} onRowClick={(p) => router.push(`/admin/projects/${p.id}`)} empty={q ? "Ничего не нашли" : "Проектов пока нет"} />
        )}
      </div>
      {data ? <Pagination page={data.page} pages={data.pages} hrefFor={(p) => qs.hrefFor({ page: p })} className="mt-[24px]" /> : null}
      <ConfirmModal open={remove !== null} title="Удалить проект?" confirmLabel="Удалить" danger busy={busy} onConfirm={doRemove} onClose={() => setRemove(null)}>
        «{remove?.title}» пропадёт с сайта. Это действие нельзя отменить.
      </ConfirmModal>
    </Card>
  );
}

/** Редактор проекта (`id` — «new» для нового). */
export function ProjectEditView({ id }: { id: string }) {
  const isNew = id === "new";
  const item = useLoad(isNew ? null : `project-item:${id}`, () => adminApi.project(Number(id)), "Не удалось загрузить проект");
  const brands = useLoad("brands", () => adminApi.brands(), "Список брендов недоступен");
  if (!isNew && item.data === null) {
    if (item.error) {
      return (
        <Card>
          <CardTitle>Проект</CardTitle>
          {item.status === 404 ? (
            <EmptyState className="mt-[21px]">
              Проект не найден.{" "}
              <Link href="/admin/projects" className="text-black underline underline-offset-[3px]">
                К списку проектов
              </Link>
            </EmptyState>
          ) : (
            <ErrorLine error={item.error} className="mt-[21px]" />
          )}
        </Card>
      );
    }
    return <Skeleton className="h-[640px] rounded-[7px]" />;
  }
  return <ProjectForm key={item.data ? `${item.data.id}:${item.data.slug}` : "new"} initial={item.data} brands={brands.data ?? []} />;
}

function ProjectForm({ initial, brands }: { initial: AdminProjectDetail | null; brands: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [date, setDate] = useState(initial?.project_date ?? new Date().toISOString().slice(0, 10));
  const [year, setYear] = useState(initial?.year ?? "");
  const [object, setObject] = useState(initial?.object ?? "");
  const [service, setService] = useState(initial?.service ?? "");
  const [image, setImage] = useState(initial?.image_url ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [body, setBody] = useState(initial?.body_text ?? "");
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);
  const [video, setVideo] = useState(initial?.video_url ?? "");
  const [brandSlugs, setBrandSlugs] = useState<string[]>(initial?.brands ?? []);
  const [products, setProducts] = useState((initial?.products ?? []).map((p) => p.code).join(", "));
  const [sort, setSort] = useState(String(initial?.sort ?? 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Укажите название проекта");
    setBusy(true);
    try {
      const input = {
        title: title.trim(),
        slug: slug.trim() || undefined,
        project_date: date,
        year: year.trim(),
        object: object.trim(),
        service: service.trim(),
        image_url: image.trim() || null,
        excerpt: excerpt.trim(),
        body_text: body,
        photos: photos.map((p) => p.trim()).filter(Boolean),
        video_url: video.trim() || null,
        brands: brandSlugs,
        products: splitList(products),
        sort: Number(sort) || 0,
      };
      const saved = initial ? await adminApi.updateProject(initial.id, input) : await adminApi.createProject(input);
      toast.success(initial ? "Проект сохранён" : "Проект опубликован");
      if (!initial) router.replace(`/admin/projects/${saved.id}`);
      else setSlug(saved.slug);
    } catch (err) {
      setError(errorMessage(err, "Не удалось сохранить проект"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={save} className="flex flex-col gap-[16px]">
        <CardTitle
          right={
            initial ? (
              <Link href={`/projects/${initial.slug}`} target="_blank" className="inline-flex items-center gap-[6px] text-[15px] leading-[20px] text-[#555] transition-colors hover:text-black">
                На сайте <ExternalLink className="size-4" aria-hidden />
              </Link>
            ) : null
          }
        >
          {initial ? "Проект" : "Новый проект"}
        </CardTitle>
        <FieldLabel label="Название" htmlFor="pj-title">
          <Input id="pj-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} className={fieldCls} />
        </FieldLabel>
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2 xl:grid-cols-4">
          <FieldLabel label="Дата" htmlFor="pj-date" hint="Сортировка — новые сверху">
            <Input id="pj-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldCls} />
          </FieldLabel>
          <FieldLabel label="Год (подпись)" htmlFor="pj-year" hint="Пусто — год из даты; можно «2024–2025»">
            <Input id="pj-year" value={year} onChange={(e) => setYear(e.target.value)} maxLength={20} className={fieldCls} />
          </FieldLabel>
          <FieldLabel label="Адрес страницы" htmlFor="pj-slug" hint={initial ? "/projects/…" : "Пусто — из названия"}>
            <Input id="pj-slug" value={slug} onChange={(e) => setSlug(e.target.value)} className={fieldCls} />
          </FieldLabel>
          <FieldLabel label="Порядок" htmlFor="pj-sort" hint="Среди проектов с одной датой">
            <Input id="pj-sort" value={sort} onChange={(e) => setSort(e.target.value)} inputMode="numeric" className={fieldCls} />
          </FieldLabel>
        </div>
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2">
          <FieldLabel label="Объект" htmlFor="pj-object">
            <Input id="pj-object" value={object} onChange={(e) => setObject(e.target.value)} maxLength={300} className={fieldCls} />
          </FieldLabel>
          <FieldLabel label="Услуга" htmlFor="pj-service" hint="Например «Поставка, Монтаж, ПНР»">
            <Input id="pj-service" value={service} onChange={(e) => setService(e.target.value)} maxLength={300} className={fieldCls} />
          </FieldLabel>
        </div>
        <FieldLabel label="Анонс" htmlFor="pj-excerpt">
          <Textarea id="pj-excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} maxLength={1000} rows={3} className={cn(fieldCls, "h-auto py-[8px]")} />
        </FieldLabel>
        <ImageField id="pj-image" label="Главная картинка" value={image} onChange={setImage} />
        <MarkupField id="pj-body" label="Описание проекта" value={body} onChange={setBody} />

        <div>
          <p className={labelCls}>Фотографии (галерея на странице проекта)</p>
          <div className="mt-[8px] flex flex-col gap-[14px]">
            {photos.map((p, i) => (
              <div key={i} className="flex items-start gap-[8px]">
                <ImageField id={`pj-photo-${i}`} label={`Фото ${i + 1}`} value={p} onChange={(v) => setPhotos((ps) => ps.map((x, j) => (j === i ? v : x)))} className="flex-1" />
                <button type="button" className={cn(iconBtn, "mt-[26px]")} onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} aria-label={`Убрать фото ${i + 1}`} title="Убрать фото">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="secondary" size="sm" className={cn(btnCls, "mt-[10px]")} icon={<Plus className="size-4" aria-hidden />} disabled={photos.length >= 30} onClick={() => setPhotos((ps) => [...ps, ""])}>
            Добавить фото
          </Button>
        </div>

        <FieldLabel label="Видео" htmlFor="pj-video" hint="Ссылка https://… (YouTube и т. п.)">
          <Input id="pj-video" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://" className={fieldCls} />
        </FieldLabel>

        <div>
          <p className={labelCls}>Бренды (логотипы на странице проекта и фильтр «Бренды»)</p>
          <div className="mt-[8px] grid grid-cols-2 gap-x-[16px] gap-y-[6px] sm:grid-cols-3 xl:grid-cols-4">
            {brands.map((b) => (
              <Checkbox
                key={b.slug}
                box={16}
                checked={brandSlugs.includes(b.slug)}
                onChange={(e) => setBrandSlugs((s) => (e.target.checked ? [...s, b.slug] : s.filter((x) => x !== b.slug)))}
                label={b.name}
                labelClassName="text-[14px]"
              />
            ))}
          </div>
        </div>

        <FieldLabel label="Применённые товары" htmlFor="pj-products" hint="Коды товаров через запятую — карточки «Применённая продукция» на странице проекта">
          <Textarea id="pj-products" value={products} onChange={(e) => setProducts(e.target.value)} rows={2} className={cn(fieldCls, "h-auto py-[8px] tnum")} />
        </FieldLabel>
        {initial?.products.length ? (
          <ul className="-mt-[8px] text-[13px] leading-[18px] text-[#555]">
            {initial.products.map((p) => (
              <li key={p.code}>
                <span className="tnum">{p.code}</span> — {p.name}
              </li>
            ))}
          </ul>
        ) : null}

        <ErrorLine error={error} />
        <div className="flex flex-wrap gap-[10px]">
          <Button type="submit" className={btnCls} loading={busy}>
            {initial ? "Сохранить" : "Опубликовать"}
          </Button>
          <ButtonLink href="/admin/projects" variant="outline" className={btnCls} icon={<ArrowLeft className="size-4" aria-hidden />}>
            К списку проектов
          </ButtonLink>
        </div>
      </form>
    </Card>
  );
}
