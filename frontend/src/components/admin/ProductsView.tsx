"use client";

import Link from "next/link";
import { Boxes, Pencil } from "lucide-react";
import { useState } from "react";
import { adminApi } from "@/lib/admin-api";
import type { AdminProduct, ProductPatch, Store } from "@/lib/admin-types";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { moneyBare, stockQty } from "@/lib/format";
import { toast } from "@/store/toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox, Toggle } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Badge as BadgeKind } from "@/lib/types";
import { DataTable, type Column } from "@/components/account/DataTable";
import { Card, CardTitle, btnCls, errorMessage, fieldCls, labelCls } from "@/components/account/shared";
import { useCatalogRefs } from "./refs";
import { ErrorLine, SearchField, Spinner, Tag, parseNum, useLoad } from "./shared";
import { useQueryState, useSearchText } from "./useQueryState";

const BADGES: BadgeKind[] = ["sale", "hit", "new"];
const iconBtn = "inline-flex size-[32px] items-center justify-center rounded-[6px] text-sub transition-colors hover:bg-btn hover:text-black";

interface Draft {
  list: string;
  sale: string;
  hit: boolean;
  isNew: boolean;
}

const ACTIVE_OPTIONS = [
  { value: "", label: "Все товары" },
  { value: "1", label: "В продаже" },
  { value: "0", label: "Сняты с продажи" },
];

/** «Товары»: поиск и фильтр по категории, правка цены / цены распродажи прямо в строке, публикация, остатки по складам (модалка). */
export function ProductsView() {
  const qs = useQueryState();
  const q = qs.get("q");
  const category = qs.get("category");
  const active = qs.get("active");
  const page = Math.max(1, Number(qs.get("page", "1")) || 1);
  const [text, setText] = useSearchText(qs);
  const refs = useCatalogRefs();
  const list = useLoad(`products:${q}:${category}:${active}:${page}`, () => adminApi.products({ q, category, active, page, per_page: 50 }), "Не удалось загрузить товары");

  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ list: "", sale: "", hit: false, isNew: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [stockFor, setStockFor] = useState<AdminProduct | null>(null);

  const replace = (p: AdminProduct) => list.mutate((d) => ({ ...d, items: d.items.map((x) => (x.id === p.id ? p : x)) }));

  const patch = async (p: AdminProduct, body: ProductPatch, success: string) => {
    setBusy(p.id);
    try {
      const r = await adminApi.updateProduct(p.id, body);
      replace(r && typeof r === "object" && "id" in r ? { ...p, ...r } : { ...p, ...body });
      toast.success(success);
      return true;
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось сохранить товар"));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const savePrices = async (p: AdminProduct) => {
    const lp = parseNum(draft.list);
    const sp = draft.sale.trim() ? parseNum(draft.sale) : null;
    if (lp === null || lp <= 0) return toast.error("Цена — число больше 0");
    if (draft.sale.trim() && (sp === null || sp <= 0 || sp >= lp)) return toast.error("Цена распродажи — больше 0 и меньше обычной цены");
    const body: ProductPatch = { list_price: lp, sale_price: sp };
    if (draft.hit !== Boolean(p.is_hit ?? p.badges?.includes("hit"))) body.is_hit = draft.hit;
    if (draft.isNew !== Boolean(p.is_new ?? p.badges?.includes("new"))) body.is_new = draft.isNew;
    if (await patch(p, body, "Товар сохранён")) setEditId(null);
  };

  const columns: Column<AdminProduct>[] = [
    { key: "code", header: "Код", className: "w-[90px]", cell: (p) => <span className="text-[14px] tnum">{p.code}</span> },
    {
      key: "name",
      header: "Товар",
      cell: (p) => (
        <span className="block min-w-[220px]">
          <Link href={`/product/${p.slug}`} target="_blank" className="line-clamp-2 font-medium text-black underline decoration-transparent underline-offset-[3px] hover:decoration-black">
            {p.name}
          </Link>
          <span className="mt-[2px] flex flex-wrap items-center gap-x-[8px] gap-y-[4px] text-[13px] leading-[18px] text-[#555]">
            {[p.brand?.name, p.category?.name].filter(Boolean).join(" · ")}
            {!p.is_active ? <Tag tone="red">снят с продажи</Tag> : null}
            {BADGES.filter((b) => p.badges?.includes(b)).map((b) => (
              <Badge key={b} kind={b} />
            ))}
          </span>
          {editId === p.id ? (
            <span className="mt-[6px] flex gap-[16px]">
              <Checkbox box={16} checked={draft.hit} onChange={(e) => setDraft((d) => ({ ...d, hit: e.target.checked }))} label="Хит продаж" labelClassName="text-[13px]" />
              <Checkbox box={16} checked={draft.isNew} onChange={(e) => setDraft((d) => ({ ...d, isNew: e.target.checked }))} label="Новинка" labelClassName="text-[13px]" />
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "price",
      header: "Цена, с.",
      align: "right",
      className: "w-[120px]",
      cell: (p) =>
        editId === p.id ? (
          <Input value={draft.list} onChange={(e) => setDraft((d) => ({ ...d, list: e.target.value }))} inputMode="decimal" aria-label="Цена" autoFocus className={cn(fieldCls, "w-[104px] text-right tnum")} />
        ) : (
          <span className={cn("whitespace-nowrap tnum", p.sale_price !== null ? "text-muted line-through" : "font-medium")}>{moneyBare(p.list_price)}</span>
        ),
    },
    {
      key: "sale",
      header: "Распродажа, с.",
      align: "right",
      className: "w-[130px]",
      cell: (p) =>
        editId === p.id ? (
          <Input value={draft.sale} onChange={(e) => setDraft((d) => ({ ...d, sale: e.target.value }))} inputMode="decimal" aria-label="Цена распродажи" placeholder="нет" className={cn(fieldCls, "w-[104px] text-right tnum")} />
        ) : p.sale_price !== null ? (
          <span className="whitespace-nowrap font-medium text-sale-text tnum">{moneyBare(p.sale_price)}</span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "stock",
      header: "Остаток",
      align: "right",
      hideBelow: "md",
      className: "w-[100px]",
      cell: (p) => (
        <span className={cn("whitespace-nowrap tnum", p.stock_total <= 0 && "text-[#D13B3E]")}>
          {stockQty(p.stock_total)} {p.unit}
        </span>
      ),
    },
    {
      key: "active",
      header: "В продаже",
      className: "w-[90px]",
      cell: (p) => (
        <Toggle
          checked={p.is_active}
          disabled={busy === p.id}
          onChange={(v) => patch(p, { is_active: v }, v ? "Товар снова в продаже" : "Товар снят с продажи")}
          label={<span className="sr-only">Товар {p.code} в продаже</span>}
          className="justify-start gap-0"
        />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "w-[100px]",
      cell: (p) =>
        editId === p.id ? (
          <span className="inline-flex flex-col items-end gap-[4px]">
            <Button size="sm" className={btnCls} loading={busy === p.id} onClick={() => savePrices(p)}>
              Сохранить
            </Button>
            <button type="button" onClick={() => setEditId(null)} className="text-[13px] text-[#555] underline underline-offset-[3px] hover:text-black">
              Отмена
            </button>
          </span>
        ) : (
          <span className="inline-flex gap-[4px]">
            <button
              type="button"
              className={iconBtn}
              onClick={() => {
                setEditId(p.id);
                setDraft({
                  list: String(p.list_price),
                  sale: p.sale_price !== null ? String(p.sale_price) : "",
                  hit: Boolean(p.is_hit ?? p.badges?.includes("hit")),
                  isNew: Boolean(p.is_new ?? p.badges?.includes("new")),
                });
              }}
              aria-label={`Изменить цены: ${p.name}`}
              title="Цены и отметки"
            >
              <Pencil className="size-4" />
            </button>
            <button type="button" className={iconBtn} onClick={() => setStockFor(p)} aria-label={`Остатки: ${p.name}`} title="Остатки по складам">
              <Boxes className="size-4" />
            </button>
          </span>
        ),
    },
  ];

  const data = list.data;
  return (
    <Card className="min-h-[347px]">
      <CardTitle right={list.loading && data ? <Spinner /> : data ? <span className="text-[15px] leading-[20px] text-[#555] tnum">Найдено: {data.total}</span> : null}>Товары</CardTitle>
      <div className="mt-[20px] flex flex-wrap items-center gap-[10px]">
        <SearchField value={text} onChange={setText} placeholder="Код или наименование" className="flex-1 sm:max-w-[360px]" />
        <Select
          options={[{ value: "", label: "Все категории" }, ...refs.categories.map((c) => ({ value: c.slug, label: c.name }))]}
          value={category}
          onChange={(e) => qs.set({ category: e.target.value })}
          aria-label="Категория"
          className="w-full sm:w-[300px]"
        />
        <Select options={ACTIVE_OPTIONS} value={active} onChange={(e) => qs.set({ active: e.target.value })} aria-label="Продажа" className="w-full sm:w-[180px]" />
      </div>
      <ErrorLine error={list.error} className="mt-[20px]" />
      <div className="mt-[28px]">
        {data === null ? (
          list.error ? null : <Skeleton className="h-[320px] rounded-[7px]" />
        ) : (
          <DataTable columns={columns} rows={data.items} rowKey={(p) => p.id} dense empty={q || category ? "Ничего не нашли — измените запрос" : "Товаров нет"} />
        )}
      </div>
      {data ? <Pagination page={data.page} pages={data.pages} hrefFor={(p) => qs.hrefFor({ page: p })} className="mt-[24px]" /> : null}
      <p className="mt-[16px] text-[13px] leading-[18px] text-sub">Снятый с продажи товар не показывается в каталоге, поиске и на главной, его нельзя добавить в корзину; оформленные заказы с ним сохраняются. Массовое обновление — через «Импорт каталога».</p>

      {stockFor ? (
        <StockModal
          key={stockFor.id}
          product={stockFor}
          onClose={() => setStockFor(null)}
          onSaved={(next) => {
            replace(next);
            setStockFor(null);
          }}
        />
      ) : null}
    </Card>
  );
}

interface StockRow {
  store_id: number;
  title: string;
  qty: string;
  /** остаток до правки известен (из карточки товара) */
  known: boolean;
}

/** Остатки по складам: текущие — из карточки товара; если она недоступна (скрытый товар), заполняются только изменяемые склады. */
function StockModal({ product, onClose, onSaved }: { product: AdminProduct; onClose: () => void; onSaved: (p: AdminProduct) => void }) {
  const stock = useLoad<StockRow[]>(`stock:${product.id}`, async () => {
    // список панели отдаёт остатки по всем складам; старый API — нет, тогда берём из карточки товара
    if (product.stock?.length) return product.stock.map((s) => ({ store_id: s.store_id, title: `${s.city}, ${s.name}`, qty: String(s.qty), known: true }));
    try {
      const rows = await adminApi.productStock(product.slug);
      if (rows.length > 0) return rows.map((s) => ({ store_id: s.store_id, title: `${s.city}, ${s.name}`, qty: String(s.qty), known: true }));
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 404) throw e;
    }
    const stores: Store[] = await adminApi.stores();
    return stores.map((s) => ({ store_id: s.id, title: `${s.city}, ${s.name}`, qty: "", known: false }));
  });
  return (
    <Modal open onClose={onClose} title="Остатки по складам" size="md">
      {stock.data === null ? (
        stock.error ? <ErrorLine error={stock.error} /> : <Skeleton className="h-[200px] rounded-[7px]" />
      ) : (
        <StockForm product={product} initial={stock.data} onClose={onClose} onSaved={onSaved} />
      )}
    </Modal>
  );
}

function StockForm({ product, initial, onClose, onSaved }: { product: AdminProduct; initial: StockRow[]; onClose: () => void; onSaved: (p: AdminProduct) => void }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unknown = rows.some((r) => !r.known);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const out: { store_id: number; qty: number }[] = [];
    for (const r of rows) {
      if (!r.qty.trim()) {
        if (r.known) out.push({ store_id: r.store_id, qty: 0 });
        continue;
      }
      const n = parseNum(r.qty);
      if (n === null || n < 0) return setError(`${r.title}: остаток — число не меньше 0`);
      out.push({ store_id: r.store_id, qty: n });
    }
    if (out.length === 0) return setError("Укажите остаток хотя бы для одного склада");
    setBusy(true);
    try {
      const r = await adminApi.saveStock(product.id, out);
      toast.success("Остатки сохранены");
      if (r && typeof r === "object" && "id" in r) onSaved({ ...product, ...r });
      else onSaved({ ...product, stock_total: unknown ? product.stock_total : out.reduce((s, x) => s + x.qty, 0) });
    } catch (err) {
      setError(errorMessage(err, "Не удалось сохранить остатки"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save}>
      <p className="text-[15px] font-semibold leading-[20px]">{product.name}</p>
      <p className={cn("mt-[2px] text-[13px] leading-[18px]", "text-[#555]")}>
        Код {product.code} · единица — {product.unit}
      </p>
      {unknown ? <p className="mt-[12px] rounded-[7px] bg-brand-light px-[12px] py-[8px] text-[13px] leading-[18px]">Текущие остатки не загрузились (товар снят с продажи). Заполните только склады, которые нужно изменить, — пустые останутся как есть.</p> : (
        <p className="mt-[12px] text-[13px] leading-[18px] text-sub">Остаток — сколько можно продать сейчас (резерв по заказам уже вычтен).</p>
      )}
      <ul className="mt-[16px] divide-y divide-line border-y border-line">
        {rows.map((r) => (
          <li key={r.store_id} className="flex items-center gap-[12px] py-[8px]">
            <span className={cn("flex-1", labelCls)}>{r.title}</span>
            <Input
              value={r.qty}
              onChange={(e) => setRows((rs) => rs.map((x) => (x.store_id === r.store_id ? { ...x, qty: e.target.value } : x)))}
              inputMode="decimal"
              placeholder={r.known ? "0" : "без изменений"}
              aria-label={`Остаток: ${r.title}`}
              className={cn(fieldCls, "w-[140px] text-right tnum")}
            />
            <span className="w-[24px] text-[14px] text-muted">{product.unit}</span>
          </li>
        ))}
      </ul>
      <ErrorLine error={error} className="mt-[12px]" />
      <div className="mt-[20px] flex justify-end gap-[10px]">
        <Button variant="outline" className={btnCls} onClick={onClose} disabled={busy}>
          Отмена
        </Button>
        <Button type="submit" className={btnCls} loading={busy}>
          Сохранить остатки
        </Button>
      </div>
    </form>
  );
}
