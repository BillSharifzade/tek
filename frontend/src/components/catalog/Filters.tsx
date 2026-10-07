"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { CategoryPage } from "@/lib/types";
import { cn } from "@/lib/cn";
import { IconChevron, IconTick } from "./icons";

interface FiltersProps {
  subcategories?: CategoryPage["children"];
  brands: CategoryPage["brands"];
  filters: CategoryPage["filters"];
  priceRange: CategoryPage["price_range"] | null;
  /** hide the brand block (on brand pages) */
  hideBrands?: boolean;
  className?: string;
}

/** Сколько значений показывать до «Показать все…» (в макете — 5 цветов). */
const VISIBLE = 5;
/** Сколько секций характеристик раскрыто изначально. */
const OPEN_ATTRS = 3;

/*
 * Панель фильтров по макету «Каталог» (10683:1085, скриншот 240×614 в x=127): секции «^ Заголовок» (Bold 14, #000),
 * чекбоксы 18×18 (обводка #697389, r=2) с подписью Regular 14 #666 «Значение (N)», шаг 25px
 * (заглавные подписи — 3…13px от верха строки); цвета — кружок 16px (шаг 27px); «Показать все…» Bold 14 #1C3697;
 * бренды — пилюли h=32 r=6 (в макете #F0F2F4, по палитре ТЗ #EEF0F2 → hover #D9DDE3).
 * На телефоне/планшете панель сворачивает FiltersToggle в CatalogShell — собственной кнопки здесь нет.
 */

function Section({ title, defaultOpen = true, children, className }: { title: string; defaultOpen?: boolean; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cn("pb-[42px]", className)}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="group flex h-[16px] w-full items-center text-left">
        <IconChevron className={cn("relative -top-[2px] ml-[2px] shrink-0 text-sub transition-transform group-hover:text-black", !open && "rotate-180")} />
        <span className="relative -top-px ml-[8px] text-[14px] font-bold leading-[16px] text-black">{title}</span>
      </button>
      {open ? children : null}
    </section>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  swatch,
  className,
}: {
  checked: boolean;
  onChange: () => void;
  label: React.ReactNode;
  swatch?: { color: string; border: boolean } | null;
  className?: string;
}) {
  return (
    <label className={cn("group flex min-h-[18px] cursor-pointer select-none items-start", className)}>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
      <span
        aria-hidden
        className={cn(
          "flex size-[18px] shrink-0 items-center justify-center rounded-[2px] border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand",
          checked ? "border-brand bg-brand text-black group-hover:border-brand-hover group-hover:bg-brand-hover" : "border-[#697389] bg-white group-hover:border-outline-hover",
        )}
      >
        {checked ? <IconTick /> : null}
      </span>
      {swatch ? (
        <span
          aria-hidden
          className={cn("ml-[8px] mt-[0.5px] size-[16px] shrink-0 rounded-full", swatch.border && "border border-[#9FA7B7]")}
          style={{ background: swatch.color }}
        />
      ) : null}
      <span className={cn("ml-[8px] text-[14px] leading-[17px] text-sub transition-colors group-hover:text-black", checked && "text-black")}>{label}</span>
    </label>
  );
}

/** «Показать все…» / «Свернуть» — Bold 14 #1C3697. */
function ShowAll({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-[3px] mt-[12px] block h-[16px] text-[14px] font-bold leading-[16px] text-link link-hover">
      {expanded ? "Свернуть" : "Показать все…"}
    </button>
  );
}

const COLORS: [RegExp, string, boolean][] = [
  [/жёлто-зел|желто-зел/, "linear-gradient(135deg, #FFCC33 0 50%, #2E9E3E 50% 100%)", false],
  [/коричн/, "#8C4F1A", false],
  [/беж/, "#F5F5DE", true],
  [/сер(ый|ая|ое|ые)|графит/, "#808080", false],
  [/серебр|металл|хром/, "#C9CDD3", true],
  [/бел/, "#FFFFFF", true],
  [/натурал|дерев/, "#EECE74", false],
  [/ч[её]рн/, "#1A1A1A", false],
  [/син/, "#2F5BD3", false],
  [/голуб/, "#6EC1F0", false],
  [/красн/, "#DF3128", false],
  [/оранж/, "#F28C28", false],
  [/ж[её]лт/, "#FFCC33", false],
  [/зел[её]н/, "#2E9E3E", false],
  [/фиолет/, "#7B3FC4", false],
  [/розов/, "#F29BB8", false],
  [/прозрач/, "#FFFFFF", true],
];

function swatchFor(value: string): { color: string; border: boolean } {
  const v = value.toLowerCase();
  const hit = COLORS.find(([re]) => re.test(v));
  return hit ? { color: hit[1], border: hit[2] } : { color: "#FFFFFF", border: true };
}

function ValueList({
  values,
  isChecked,
  toggle,
  color,
}: {
  values: { value: string; label?: string; count?: number }[];
  isChecked: (v: string) => boolean;
  toggle: (v: string) => void;
  color?: boolean;
}) {
  const hiddenChecked = values.slice(VISIBLE).some((v) => isChecked(v.value));
  const [expanded, setExpanded] = useState(hiddenChecked);
  const shown = expanded ? values : values.slice(0, VISIBLE);
  return (
    <>
      <ul className={cn("mt-[17px] flex flex-col", color ? "gap-[9px]" : "gap-[7px]")}>
        {shown.map((v) => (
          <li key={v.value}>
            <CheckRow
              checked={isChecked(v.value)}
              onChange={() => toggle(v.value)}
              swatch={color ? swatchFor(v.value) : null}
              label={
                <>
                  {v.label ?? v.value}
                  {v.count !== undefined ? <span className="tnum"> ({v.count})</span> : null}
                </>
              }
            />
          </li>
        ))}
      </ul>
      {values.length > VISIBLE ? <ShowAll expanded={expanded} onClick={() => setExpanded((e) => !e)} /> : null}
    </>
  );
}

function PriceInputs({ priceRange, initialMin, initialMax, apply }: { priceRange: CategoryPage["price_range"] | null; initialMin: string; initialMax: string; apply: (min: string, max: string) => void }) {
  const [min, setMin] = useState(initialMin);
  const [max, setMax] = useState(initialMax);
  const submit = () => {
    if (min !== initialMin || max !== initialMax) apply(min.trim(), max.trim());
  };
  const field =
    "h-[32px] w-full min-w-0 rounded-[5px] border border-transparent bg-field px-[12px] text-[14px] leading-[16px] text-black outline-none transition-colors placeholder:text-muted hover:border-outline focus:border-outline-hover tnum";
  return (
    <form
      className="mt-[18px] flex items-center gap-[8px]"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        type="number"
        inputMode="decimal"
        min={0}
        className={field}
        placeholder={priceRange ? `от ${Math.floor(priceRange.min)}` : "от"}
        value={min}
        onChange={(e) => setMin(e.target.value)}
        onBlur={submit}
        aria-label="Цена от"
      />
      <span className="text-[14px] text-muted">—</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        className={field}
        placeholder={priceRange ? `до ${Math.ceil(priceRange.max)}` : "до"}
        value={max}
        onChange={(e) => setMax(e.target.value)}
        onBlur={submit}
        aria-label="Цена до"
      />
      <button type="submit" className="sr-only">
        Применить
      </button>
    </form>
  );
}

export function Filters({ subcategories, brands, filters, priceRange, hideBrands, className }: FiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [allBrands, setAllBrands] = useState(false);

  const navigate = (mutate: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(sp.toString());
    mutate(p);
    p.delete("page");
    const s = p.toString();
    startTransition(() => router.push(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };

  const toggleMulti = (key: string, value: string) =>
    navigate((p) => {
      const all = p.getAll(key);
      p.delete(key);
      const next = all.includes(value) ? all.filter((x) => x !== value) : [...all, value];
      next.forEach((v) => p.append(key, v));
    });

  const toggleFlag = (key: string) => navigate((p) => (p.get(key) === "1" ? p.delete(key) : p.set(key, "1")));

  const selectedBrands = sp.getAll("brand");
  const activeCount =
    selectedBrands.length +
    (sp.get("price_min") ? 1 : 0) +
    (sp.get("price_max") ? 1 : 0) +
    [...sp.keys()].filter((k) => k.startsWith("attr.")).length +
    ["in_stock", "sale", "hit", "new"].filter((k) => sp.get(k) === "1").length;

  const reset = () =>
    navigate((p) => {
      for (const k of [...p.keys()]) {
        if (k.startsWith("attr.") || ["brand", "price_min", "price_max", "in_stock", "sale", "hit", "new"].includes(k)) p.delete(k);
      }
    });

  const shownBrands = allBrands ? brands : brands.slice(0, 12);

  return (
    <aside className={cn("w-full lg:w-[240px]", className)} aria-label="Фильтры">
      <div className={cn(pending && "opacity-60 transition-opacity")}>
        {subcategories && subcategories.length > 0 ? (
          <Section title="Категории">
            <ul className="mt-[18px] flex flex-col gap-[7px]">
              {subcategories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/catalog/${c.slug}`} className="text-[14px] leading-[17px] text-sub link-hover">
                    {c.name} <span className="tnum">({c.product_count})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {filters.map((f, i) => {
          const key = `attr.${f.name}`;
          const selected = sp.getAll(key);
          return (
            <Section key={f.name} title={f.name} defaultOpen={i < OPEN_ATTRS || selected.length > 0}>
              <ValueList values={f.values} isChecked={(v) => selected.includes(v)} toggle={(v) => toggleMulti(key, v)} color={/цвет/i.test(f.name)} />
            </Section>
          );
        })}

        {!hideBrands && brands.length > 0 ? (
          <Section title="Бренд">
            <ul className="ml-[2px] mt-[19px] flex max-w-[220px] flex-wrap gap-[4px]">
              {shownBrands.map((b) => {
                const on = selectedBrands.includes(b.slug);
                return (
                  <li key={b.slug}>
                    <button
                      type="button"
                      aria-pressed={on}
                      title={`${b.name} (${b.count})`}
                      onClick={() => toggleMulti("brand", b.slug)}
                      className={cn(
                        "h-[32px] rounded-[6px] px-[13px] text-[14px] leading-[16px] text-g333 transition-colors",
                        on ? "bg-brand text-black hover:bg-brand-hover" : "bg-btn hover:bg-btn-hover",
                      )}
                    >
                      {b.name}
                    </button>
                  </li>
                );
              })}
            </ul>
            {brands.length > 12 ? <ShowAll expanded={allBrands} onClick={() => setAllBrands((v) => !v)} /> : null}
          </Section>
        ) : null}

        <Section title="Цена, с.">
          <PriceInputs
            key={`${sp.get("price_min") ?? ""}|${sp.get("price_max") ?? ""}`}
            priceRange={priceRange}
            initialMin={sp.get("price_min") ?? ""}
            initialMax={sp.get("price_max") ?? ""}
            apply={(min, max) =>
              navigate((p) => {
                if (min) p.set("price_min", min);
                else p.delete("price_min");
                if (max) p.set("price_max", max);
                else p.delete("price_max");
              })
            }
          />
        </Section>

        <Section title="Наличие и акции">
          <ValueList
            values={[
              { value: "in_stock", label: "В наличии" },
              { value: "sale", label: "Распродажа" },
              { value: "hit", label: "Хит продаж" },
              { value: "new", label: "Новинка" },
            ]}
            isChecked={(k) => sp.get(k) === "1"}
            toggle={toggleFlag}
          />
        </Section>

        {activeCount > 0 ? (
          <button
            type="button"
            onClick={reset}
            className="mb-[42px] h-[32px] w-full rounded-[5px] bg-btn text-[13px] leading-[12px] text-black transition-colors hover:bg-btn-hover"
          >
            Сбросить фильтры ({activeCount})
          </button>
        ) : null}
      </div>
    </aside>
  );
}
