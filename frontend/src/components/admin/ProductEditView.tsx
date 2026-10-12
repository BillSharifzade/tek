"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { adminApi } from "@/lib/admin-api";
import type { AdminDocument, AdminProductDetail } from "@/lib/admin-types";
import { PUBLIC_API_URL } from "@/lib/api";
import { cn } from "@/lib/cn";
import { COUNTRY_NAMES } from "@/lib/countries";
import { toast } from "@/store/toast";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card, CardTitle, EmptyState, btnCls, errorMessage, fieldCls, labelCls } from "@/components/account/shared";
import { ErrorLine, InfoRow, SearchField, Tag, useLoad } from "./shared";

export const DOC_KIND_OPTIONS = [
  { value: "certificate", label: "Сертификат" },
  { value: "declaration", label: "Декларация" },
  { value: "passport", label: "Паспорт / инструкция" },
  { value: "drawing", label: "Чертёж" },
  { value: "catalog", label: "Каталог" },
  { value: "other", label: "Другое" },
];
export const docKindLabel = (k: string) => DOC_KIND_OPTIONS.find((o) => o.value === k)?.label ?? k;
export const docHref = (d: Pick<AdminDocument, "id">) => `${PUBLIC_API_URL}/documents/${d.id}/download`;

const iconBtn = "inline-flex size-[32px] shrink-0 items-center justify-center rounded-[6px] text-sub transition-colors hover:bg-btn hover:text-black";

/** Подсказки названий стран (с флагом в карточке товара показываются только они). */
export function CountryList({ id }: { id: string }) {
  return (
    <datalist id={id}>
      {COUNTRY_NAMES.map((c) => (
        <option key={c} value={c} />
      ))}
    </datalist>
  );
}

/**
 * Карточка товара в панели: страна производства, документы (из общей библиотеки или новые — файлом / ссылкой),
 * комплектующие (по кодам, по группам) и торговое предложение (группа исполнений, оси, значения).
 * Цены, остатки и публикация — в списке «Товары».
 */
export function ProductEditView({ id }: { id: string }) {
  const product = useLoad(`admin-product:${id}`, () => adminApi.product(id), "Не удалось загрузить товар");

  if (product.data === null) {
    if (product.error) {
      return (
        <Card>
          <CardTitle>Карточка товара</CardTitle>
          {product.status === 404 ? (
            <EmptyState className="mt-[21px]">
              Товар не найден.{" "}
              <Link href="/admin/products" className="text-black underline underline-offset-[3px]">
                К списку товаров
              </Link>
            </EmptyState>
          ) : (
            <ErrorLine error={product.error} className="mt-[21px]" />
          )}
        </Card>
      );
    }
    return (
      <div className="flex flex-col gap-[16px] lg:gap-[27px]" aria-busy>
        <Skeleton className="h-[180px] rounded-[7px]" />
        <Skeleton className="h-[260px] rounded-[7px]" />
      </div>
    );
  }

  const p = product.data;
  const set = (next: AdminProductDetail) => product.mutate(() => next);
  return (
    <div className="flex flex-col gap-[16px] lg:gap-[27px]">
      <SummaryCard key={`${p.country_origin}`} product={p} onChange={set} />
      <DocumentsCard product={p} onChange={set} onReload={product.reload} />
      <AccessoriesCard key={JSON.stringify(p.accessories)} product={p} onChange={set} />
      <VariantCard key={JSON.stringify(p.variant)} product={p} onChange={set} />
      <div className="flex flex-wrap gap-[10px]">
        <ButtonLink href="/admin/products" variant="outline" className={btnCls} icon={<ArrowLeft className="size-4" aria-hidden />}>
          К списку товаров
        </ButtonLink>
      </div>
    </div>
  );
}

function SummaryCard({ product: p, onChange }: { product: AdminProductDetail; onChange: (p: AdminProductDetail) => void }) {
  const [origin, setOrigin] = useState(p.country_origin ?? "");
  const [busy, setBusy] = useState(false);
  const brandOrigin = p.brand_info?.country_origin;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const next = await adminApi.updateProduct(p.id, { country_origin: origin.trim() || null });
      onChange({ ...p, ...(next as Partial<AdminProductDetail>) });
      toast.success("Страна производства сохранена");
    } catch (err) {
      toast.error(errorMessage(err, "Не удалось сохранить"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardTitle
        right={
          <Link href={`/product/${p.slug}`} target="_blank" className="inline-flex items-center gap-[6px] text-[15px] leading-[20px] text-[#555] transition-colors hover:text-black">
            На сайте <ExternalLink className="size-4" aria-hidden />
          </Link>
        }
      >
        {p.name}
      </CardTitle>
      <dl className="mt-[21px] flex flex-col gap-[6px]">
        <InfoRow title="Код">
          <span className="tnum">{p.code}</span>
          {!p.is_active ? (
            <Tag tone="red" className="ml-[8px]">
              снят с продажи
            </Tag>
          ) : null}
        </InfoRow>
        <InfoRow title="Категория">{p.category?.name ?? "—"}</InfoRow>
        <InfoRow title="Бренд">
          {p.brand_info ? (
            <>
              {p.brand_info.name}
              <span className="block font-normal text-[#555]">
                Страна бренда: {p.brand_info.country_brand ?? "не указана"} · производства: {p.brand_info.country_origin ?? "не указана"} —{" "}
                <Link href={`/admin/brands?q=${encodeURIComponent(p.brand_info.name)}`} className="underline underline-offset-[3px] hover:text-black">
                  изменить у бренда
                </Link>
              </span>
            </>
          ) : (
            "—"
          )}
        </InfoRow>
      </dl>
      <form onSubmit={save} className="mt-[20px] border-t border-line pt-[18px]">
        <label htmlFor="pe-origin" className={labelCls}>
          Страна производства этого товара — если отличается от страны бренда (флаг в карточке товара)
        </label>
        <div className="mt-[10px] flex flex-wrap gap-[10px]">
          <Input
            id="pe-origin"
            list="pe-countries"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder={brandOrigin ? `как у бренда: ${brandOrigin}` : "Страна"}
            maxLength={60}
            className={cn(fieldCls, "w-full sm:w-[280px]")}
          />
          <CountryList id="pe-countries" />
          <Button type="submit" className={btnCls} loading={busy} disabled={(p.country_origin ?? "") === origin.trim()}>
            Сохранить
          </Button>
        </div>
      </form>
    </Card>
  );
}

function DocumentsCard({ product: p, onChange, onReload }: { product: AdminProductDetail; onChange: (p: AdminProductDetail) => void; onReload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const search = useLoad(q.trim().length >= 2 ? `doc-search:${q.trim()}` : null, () => adminApi.documents({ q: q.trim(), per_page: 8 }));
  const ids = p.documents.map((d) => d.id);

  const setLinks = async (next: number[], success: string) => {
    setBusy(true);
    try {
      onChange(await adminApi.setProductDocuments(p.id, next));
      toast.success(success);
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось сохранить документы"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardTitle right={<span className={cn(labelCls, "tnum")}>{p.documents.length}</span>}>Документы</CardTitle>
      {p.documents.length > 0 ? (
        <ul className="mt-[18px] divide-y divide-line border-y border-line">
          {p.documents.map((d) => (
            <li key={d.id} className="flex items-center gap-[12px] py-[10px]">
              <div className="min-w-0 flex-1">
                <a href={docHref(d)} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-[15px] font-medium leading-[20px] text-black underline decoration-transparent underline-offset-[3px] hover:decoration-black">
                  {d.title}
                </a>
                <span className="block text-[13px] leading-[18px] text-[#555]">
                  #{d.id} · {docKindLabel(d.kind)} · {d.has_file ? `файл ${d.file_name}` : d.url ? "ссылка" : "образец (демо)"}
                </span>
              </div>
              <button type="button" className={iconBtn} disabled={busy} onClick={() => setLinks(ids.filter((x) => x !== d.id), "Документ убран у товара")} aria-label={`Убрать: ${d.title}`} title="Убрать у товара">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn("mt-[18px]", labelCls)}>Документов нет — вкладка «Документация» на странице товара не показывается.</p>
      )}

      <div className="mt-[20px] grid grid-cols-1 gap-[20px] border-t border-line pt-[18px] xl:grid-cols-2">
        <div>
          <p className="text-[15px] font-semibold leading-[20px]">Добавить из библиотеки</p>
          <p className={cn("mt-[4px]", "text-[13px] leading-[18px] text-[#555]")}>Один документ (например, сертификат на серию) можно привязать к нескольким товарам.</p>
          <SearchField value={q} onChange={setQ} placeholder="Название документа" className="mt-[10px]" />
          {search.data ? (
            <ul className="mt-[8px] flex flex-col">
              {search.data.items.map((d) => {
                const linked = ids.includes(d.id);
                return (
                  <li key={d.id} className="flex items-center gap-[10px] border-b border-line py-[8px] last:border-b-0">
                    <span className="min-w-0 flex-1 text-[14px] leading-[18px]">
                      {d.title}
                      <span className="block text-[13px] text-[#555]">
                        #{d.id} · {docKindLabel(d.kind)}
                      </span>
                    </span>
                    <Button size="sm" variant="secondary" className={btnCls} disabled={linked || busy} onClick={() => setLinks([...ids, d.id], "Документ добавлен")}>
                      {linked ? "Уже есть" : "Добавить"}
                    </Button>
                  </li>
                );
              })}
              {search.data.items.length === 0 ? <li className="py-[8px] text-[14px] text-muted">Ничего не нашли</li> : null}
            </ul>
          ) : null}
        </div>
        <NewDocumentForm
          productId={p.id}
          onCreated={() => {
            onReload();
            toast.success("Документ загружен и добавлен к товару");
          }}
        />
      </div>
    </Card>
  );
}

/** Новый документ — файлом (PDF и др., до 20 МБ) или ссылкой; `productId` — сразу привязать к товару. */
export function NewDocumentForm({ productId, onCreated, className }: { productId?: string; onCreated: (d: AdminDocument) => void; className?: string }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file && !url.trim()) return setError("Выберите файл или укажите ссылку");
    if (file && file.size > 20 * 1024 * 1024) return setError("Файл больше 20 МБ");
    setBusy(true);
    try {
      const d = await adminApi.createDocument({ title: title.trim() || undefined, kind: kind || undefined, url: file ? undefined : url.trim(), file, product_id: productId });
      setTitle("");
      setKind("");
      setUrl("");
      setFile(null);
      onCreated(d);
    } catch (err) {
      setError(errorMessage(err, "Не удалось добавить документ"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={className}>
      <p className="text-[15px] font-semibold leading-[20px]">Новый документ</p>
      <p className="mt-[4px] text-[13px] leading-[18px] text-[#555]">Файл PDF, JPG, DOC(X), XLS(X), DWG, ZIP до 20 МБ — или ссылка на сайт производителя.</p>
      <div className="mt-[10px] flex flex-col gap-[10px]">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название (иначе — по имени файла)" aria-label="Название документа" maxLength={300} className={fieldCls} />
        <Select options={[{ value: "", label: "Вид — по названию" }, ...DOC_KIND_OPTIONS]} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Вид документа" />
        <div className="flex min-w-0 items-center gap-[10px]">
          <Button variant="secondary" size="sm" className={cn(btnCls, "shrink-0")} onClick={() => fileRef.current?.click()}>
            {file ? "Другой файл" : "Выбрать файл"}
          </Button>
          <span className="min-w-0 truncate text-[14px] leading-[20px] text-[#555]">{file ? file.name : "файл не выбран"}</span>
          {file ? (
            <button type="button" className={iconBtn} onClick={() => setFile(null)} aria-label="Убрать файл" title="Убрать файл">
              <X className="size-4" />
            </button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.zip,.rar,.7z"
            hidden
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
            aria-label="Файл документа"
          />
        </div>
        {!file ? <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="или ссылка https://…" aria-label="Ссылка на документ" inputMode="url" className={fieldCls} /> : null}
      </div>
      <ErrorLine error={error} className="mt-[10px]" />
      <Button type="submit" className={cn(btnCls, "mt-[12px]")} loading={busy} icon={<Plus className="size-4" aria-hidden />}>
        {productId ? "Добавить к товару" : "Добавить в библиотеку"}
      </Button>
    </form>
  );
}

interface AccRow {
  key: number;
  group: string;
  code: string;
  name?: string;
}

function AccessoriesCard({ product: p, onChange }: { product: AdminProductDetail; onChange: (p: AdminProductDetail) => void }) {
  const [rows, setRows] = useState<AccRow[]>(() => p.accessories.map((a, i) => ({ key: i, group: a.group, code: a.code, name: a.name })));
  const [seq, setSeq] = useState(p.accessories.length);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groups = [...new Set(rows.map((r) => r.group.trim()).filter(Boolean))];
  const dirty = JSON.stringify(rows.map((r) => [r.group.trim(), r.code.trim()])) !== JSON.stringify(p.accessories.map((a) => [a.group, a.code]));

  const update = (key: number, patch: Partial<AccRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, name: patch.code !== undefined ? undefined : r.name } : r)));
  const add = () => {
    setRows((rs) => [...rs, { key: seq, group: rs[rs.length - 1]?.group ?? "Комплектующие", code: "" }]);
    setSeq((s) => s + 1);
  };
  const save = async () => {
    setError(null);
    const items = rows.map((r) => ({ group: r.group.trim(), code: r.code.trim() })).filter((r) => r.code);
    if (items.some((r) => !r.group)) return setError("Укажите группу для каждого товара");
    setBusy(true);
    try {
      onChange(await adminApi.setProductAccessories(p.id, items));
      toast.success("Комплектующие сохранены");
    } catch (e) {
      setError(errorMessage(e, "Не удалось сохранить комплектующие"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardTitle right={<span className={cn(labelCls, "tnum")}>{p.accessories.length}</span>}>Комплектующие</CardTitle>
      <p className={cn("mt-[12px]", labelCls)}>Вкладка «Комплектующие» на странице товара: группы (чипсы) и товары по коду в порядке списка.</p>
      {rows.length > 0 ? (
        <ul className="mt-[16px] flex flex-col gap-[8px]">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center gap-[8px]">
              <Input value={r.group} onChange={(e) => update(r.key, { group: e.target.value })} list="pe-acc-groups" placeholder="Группа" aria-label="Группа" maxLength={100} className={cn(fieldCls, "w-[200px]")} />
              <Input value={r.code} onChange={(e) => update(r.key, { code: e.target.value })} placeholder="Код товара" aria-label="Код товара" className={cn(fieldCls, "w-[140px] tnum")} />
              <span className="min-w-[120px] flex-1 truncate text-[14px] leading-[18px] text-[#555]">{r.name ?? ""}</span>
              <button type="button" className={iconBtn} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Убрать" title="Убрать">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-[16px] text-[14px] text-muted">Комплектующих нет.</p>
      )}
      <datalist id="pe-acc-groups">
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <ErrorLine error={error} className="mt-[12px]" />
      <div className="mt-[16px] flex flex-wrap gap-[10px]">
        <Button variant="secondary" className={btnCls} icon={<Plus className="size-4" aria-hidden />} onClick={add}>
          Добавить товар
        </Button>
        <Button className={btnCls} loading={busy} disabled={!dirty} onClick={save}>
          Сохранить комплектующие
        </Button>
      </div>
    </Card>
  );
}

interface AxisRow {
  key: number;
  axis: string;
  value: string;
}

function VariantCard({ product: p, onChange }: { product: AdminProductDetail; onChange: (p: AdminProductDetail) => void }) {
  const v = p.variant;
  const [group, setGroup] = useState(v?.group ?? "");
  const [rows, setRows] = useState<AxisRow[]>(() => (v ? v.axes.map((a, i) => ({ key: i, axis: a, value: v.values[a] ?? "" })) : [{ key: 0, axis: "", value: "" }]));
  const [seq, setSeq] = useState(Math.max(1, v?.axes.length ?? 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (body: Parameters<typeof adminApi.setProductVariant>[1], success: string) => {
    setError(null);
    setBusy(true);
    try {
      onChange(await adminApi.setProductVariant(p.id, body));
      toast.success(success);
    } catch (e) {
      setError(errorMessage(e, "Не удалось сохранить торговое предложение"));
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    const filled = rows.map((r) => ({ axis: r.axis.trim(), value: r.value.trim() })).filter((r) => r.axis);
    if (!group.trim()) return setError("Укажите название группы");
    if (filled.length === 0) return setError("Добавьте хотя бы одну ось, например «Номинальный ток, А»");
    if (filled.some((r) => !r.value)) return setError("Заполните значения всех осей");
    send({ group: group.trim(), axes: filled.map((r) => r.axis), values: filled }, "Торговое предложение сохранено");
  };

  return (
    <Card>
      <CardTitle>Торговое предложение</CardTitle>
      <p className={cn("mt-[12px]", labelCls)}>
        Один товар в нескольких исполнениях (как у Петровича): у группы — оси (например, «Число полюсов» и «Номинальный ток, А»), у каждого исполнения — свои значения. На странице товара появятся кнопки выбора исполнения.
      </p>
      <div className="mt-[16px] flex flex-col gap-[10px]">
        <Input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Название группы, например «Автоматический выключатель Easy9 C»" aria-label="Название группы" maxLength={200} className={fieldCls} />
        {rows.map((r) => (
          <div key={r.key} className="flex flex-wrap items-center gap-[8px]">
            <Input value={r.axis} onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, axis: e.target.value } : x)))} placeholder="Ось" aria-label="Ось" maxLength={100} className={cn(fieldCls, "w-[220px]")} />
            <Input value={r.value} onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, value: e.target.value } : x)))} placeholder="Значение у этого товара" aria-label={`Значение: ${r.axis}`} maxLength={100} className={cn(fieldCls, "w-[200px]")} />
            <button type="button" className={iconBtn} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Убрать ось" title="Убрать ось">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <ErrorLine error={error} className="mt-[12px]" />
      <div className="mt-[16px] flex flex-wrap gap-[10px]">
        <Button
          variant="secondary"
          className={btnCls}
          icon={<Plus className="size-4" aria-hidden />}
          disabled={rows.length >= 5}
          onClick={() => {
            setRows((rs) => [...rs, { key: seq, axis: "", value: "" }]);
            setSeq((s) => s + 1);
          }}
        >
          Добавить ось
        </Button>
        <Button className={btnCls} loading={busy} onClick={save}>
          Сохранить
        </Button>
        {v ? (
          <Button variant="outline" className={btnCls} disabled={busy} onClick={() => send({ group: null, values: [] }, "Товар выведен из группы")}>
            Убрать из группы
          </Button>
        ) : null}
      </div>
      {v ? (
        <div className="mt-[20px] border-t border-line pt-[16px]">
          <p className="text-[15px] font-semibold leading-[20px]">Другие исполнения группы ({v.siblings.length})</p>
          {v.siblings.length === 0 ? (
            <p className={cn("mt-[6px]", labelCls)}>Пока только этот товар — кнопки выбора появятся, когда в группе будет два исполнения и больше.</p>
          ) : (
            <ul className="mt-[8px] flex flex-col divide-y divide-line">
              {v.siblings.map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline gap-x-[12px] gap-y-[2px] py-[8px] text-[14px] leading-[18px]">
                  <Link href={`/admin/products/${s.id}`} className="min-w-[200px] flex-1 text-black underline decoration-transparent underline-offset-[3px] hover:decoration-black">
                    <span className="tnum text-[#555]">{s.code}</span> {s.name}
                  </Link>
                  <span className="text-[#555]">
                    {v.axes.map((a, i) => (
                      <span key={a}>
                        {i > 0 ? " · " : ""}
                        {s.values[a] ? s.values[a] : <span className="text-[#D13B3E]">нет «{a}»</span>}
                      </span>
                    ))}
                  </span>
                  {!s.is_active ? <Tag tone="red">снят с продажи</Tag> : null}
                </li>
              ))}
            </ul>
          )}
          {v.siblings.some((s) => v.axes.some((a) => !s.values[a])) ? (
            <p className="mt-[8px] text-[13px] leading-[18px] text-[#D13B3E]">Исполнения без значения по какой-либо оси не показываются в выборе — откройте их и заполните значения.</p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
