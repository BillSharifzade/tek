"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Accessory } from "@/lib/types";
import { cn } from "@/lib/cn";
import { toast } from "@/store/toast";
import { Modal } from "@/components/ui/Modal";
import { ProductCard } from "@/components/product/ProductCard";

const yellowBtn =
  "flex h-[44px] w-full items-center justify-center rounded-[5px] bg-brand text-[15px] font-medium leading-[24px] text-black transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60";

/** «Поделиться корзиной» (референс 10522:1968): жёлтая шапка, ссылка в поле с нижней линией, «Копировать». */
export function ShareCartModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Ссылка на корзину скопирована");
    } catch {
      toast.info("Выделите ссылку и скопируйте её вручную");
    }
  };
  return (
    <Modal
      open={url !== null}
      onClose={() => {
        setCopied(false);
        onClose();
      }}
      title="Поделиться корзиной"
      size="sm"
      bodyClassName="px-[24px] pb-[24px] pt-[28px]"
    >
      <input
        readOnly
        value={url ?? ""}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Ссылка на корзину"
        className="block h-[32px] w-full border-b border-outline bg-transparent pb-[4px] text-[15px] leading-[20px] text-black outline-none transition-colors focus:border-outline-hover"
      />
      <p className="mt-[8px] text-[13px] leading-[17px] text-muted">По ссылке откроется копия корзины — получатель сможет добавить товары к себе.</p>
      <button type="button" onClick={copy} className={cn(yellowBtn, "mt-[20px]")}>
        {copied ? "Скопировано" : "Копировать"}
      </button>
    </Modal>
  );
}

/**
 * «Комплектующие» → модалка «Вам может понадобиться» (референс 10522:1969): панель справа,
 * жёлтая шапка, чипсы-категории (выбранная — жёлтая), сетка карточек товара.
 */
export function AccessoriesModal({ data, onClose }: { data: { name: string; items: Accessory[] } | null; onClose: () => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of data?.items ?? []) m.set(a.group, (m.get(a.group) ?? 0) + 1);
    return [...m.entries()];
  }, [data]);
  const [group, setGroup] = useState<string | null>(null);
  const active = group && groups.some(([g]) => g === group) ? group : null;
  const items = (data?.items ?? []).filter((a) => !active || a.group === active);

  return (
    <Modal
      open={data !== null}
      onClose={() => {
        setGroup(null);
        onClose();
      }}
      title="Вам может понадобиться"
      drawer
      className="max-w-[1010px]"
      bodyClassName="px-[24px] pt-[20px] pb-[32px]"
    >
      {data ? (
        <>
          <p className="text-[14px] leading-[18px] text-sub">
            Комплектующие к товару <span className="text-black">«{data.name}»</span>
          </p>
          {data.items.length === 0 ? (
            <div className="mt-[24px] rounded-[7px] bg-surface px-[20px] py-[28px] text-center">
              <p className="text-[15px] font-medium leading-[20px]">Для этого товара нет подобранных комплектующих</p>
              <Link href="/catalog" className="link-hover mt-[8px] inline-block text-[14px] leading-[20px] text-link" onClick={onClose}>
                Перейти в каталог
              </Link>
            </div>
          ) : (
            <>
              {groups.length > 1 ? (
                <div className="mt-[16px] flex flex-wrap gap-[8px]" role="tablist" aria-label="Категории комплектующих">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={!active}
                    onClick={() => setGroup(null)}
                    className={cn("h-[32px] rounded-[5px] px-[12px] text-[14px] leading-[20px] transition-colors", !active ? "bg-brand hover:bg-brand-hover" : "bg-btn hover:bg-btn-hover")}
                  >
                    Все ({data.items.length})
                  </button>
                  {groups.map(([g, n]) => (
                    <button
                      key={g}
                      type="button"
                      role="tab"
                      aria-selected={active === g}
                      onClick={() => setGroup(g)}
                      className={cn("h-[32px] rounded-[5px] px-[12px] text-[14px] leading-[20px] transition-colors", active === g ? "bg-brand hover:bg-brand-hover" : "bg-btn hover:bg-btn-hover")}
                    >
                      {g} ({n})
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mt-[24px] grid grid-cols-2 gap-x-[20px] gap-y-[32px] xl:grid-cols-[repeat(4,226px)] xl:justify-between">
                {items.map((a) => (
                  <ProductCard key={a.product.id} product={a.product} />
                ))}
              </div>
            </>
          )}
        </>
      ) : null}
    </Modal>
  );
}

/** «Сохранить смету» — имя сметы (сметы живут в ЛК → «Мои сметы»). */
export function SaveEstimateModal({ open, busy, onClose, onSave }: { open: boolean; busy: boolean; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Сохранить смету" size="sm" bodyClassName="px-[24px] pb-[24px] pt-[28px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(name);
          setName("");
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Смета от ${new Date().toLocaleDateString("ru-RU")}`}
          aria-label="Название сметы"
          autoFocus
          className="block h-[32px] w-full border-b border-outline bg-transparent pb-[4px] text-[15px] leading-[20px] text-black outline-none transition-colors placeholder:text-muted focus:border-outline-hover"
        />
        <p className="mt-[8px] text-[13px] leading-[17px] text-muted">Смета появится в личном кабинете в разделе «Мои сметы».</p>
        <button type="submit" disabled={busy} className={cn(yellowBtn, "mt-[20px]")}>
          {busy ? "Сохраняем…" : "Сохранить"}
        </button>
      </form>
    </Modal>
  );
}
