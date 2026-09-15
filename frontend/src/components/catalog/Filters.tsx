"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, X } from "lucide-react";
import type { CategoryPage } from "@/lib/types";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Checkbox, Toggle } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface FiltersProps {
  subcategories?: CategoryPage["children"];
  brands: CategoryPage["brands"];
  filters: CategoryPage["filters"];
  priceRange: CategoryPage["price_range"] | null;
  /** hide the brand block (on brand pages) */
  hideBrands?: boolean;
  className?: string;
}

function Group({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line py-4 last:border-b-0">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-base font-semibold" aria-expanded={open}>
        {title}
        <ChevronDown className={cn("size-4 text-sub transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="mt-3 flex flex-col gap-2">{children}</div> : null}
    </div>
  );
}

export function Filters({ subcategories, brands, filters, priceRange, hideBrands, className }: FiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [priceMin, setPriceMin] = useState(sp.get("price_min") ?? "");
  const [priceMax, setPriceMax] = useState(sp.get("price_max") ?? "");

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

  const selectedBrands = sp.getAll("brand");
  const inStock = sp.get("in_stock") === "1";
  const activeCount =
    selectedBrands.length +
    (inStock ? 1 : 0) +
    (sp.get("price_min") ? 1 : 0) +
    (sp.get("price_max") ? 1 : 0) +
    [...sp.keys()].filter((k) => k.startsWith("attr.")).length +
    ["sale", "hit", "new"].filter((k) => sp.get(k) === "1").length;

  return (
    <aside className={cn("rounded-[8px] border border-line bg-white px-5 py-1", pending && "opacity-70", className)} aria-label="Фильтры">
      {subcategories && subcategories.length > 0 ? (
        <Group title="Категории товаров">
          <ul className="flex flex-col gap-1.5">
            {subcategories.map((c) => (
              <li key={c.slug}>
                <Link href={`/catalog/${c.slug}`} className="flex items-center justify-between gap-2 text-base hover:text-brand-hover">
                  <span>{c.name}</span>
                  <span className="text-xs text-muted tnum">{c.product_count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      <Group title="Наличие и акции">
        <Toggle checked={inStock} onChange={(v) => navigate((p) => (v ? p.set("in_stock", "1") : p.delete("in_stock")))} label="В наличии" />
        {(["sale", "hit", "new"] as const).map((k) => (
          <Checkbox
            key={k}
            checked={sp.get(k) === "1"}
            onChange={(e) => navigate((p) => (e.target.checked ? p.set(k, "1") : p.delete(k)))}
            label={k === "sale" ? "Распродажа" : k === "hit" ? "Хит продаж" : "Новинка"}
          />
        ))}
      </Group>

      {priceRange ? (
        <Group title="Цена, с.">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              navigate((p) => {
                if (priceMin) p.set("price_min", priceMin);
                else p.delete("price_min");
                if (priceMax) p.set("price_max", priceMax);
                else p.delete("price_max");
              });
            }}
          >
            <Input type="number" inputMode="decimal" min={0} placeholder={String(Math.floor(priceRange.min))} value={priceMin} onChange={(e) => setPriceMin(e.target.value)} aria-label="Цена от" />
            <span className="text-muted">—</span>
            <Input type="number" inputMode="decimal" min={0} placeholder={String(Math.ceil(priceRange.max))} value={priceMax} onChange={(e) => setPriceMax(e.target.value)} aria-label="Цена до" />
            <Button type="submit" variant="secondary" size="md" className="px-3">
              ОК
            </Button>
          </form>
          <p className="text-xs text-muted">
            от {money(priceRange.min)} до {money(priceRange.max)}
          </p>
        </Group>
      ) : null}

      {!hideBrands && brands.length > 0 ? (
        <Group title="Бренд">
          {brands.slice(0, 12).map((b) => (
            <Checkbox
              key={b.slug}
              checked={selectedBrands.includes(b.slug)}
              onChange={() => toggleMulti("brand", b.slug)}
              label={
                <span className="flex items-center gap-2">
                  {b.name}
                  <span className="text-xs text-muted tnum">{b.count}</span>
                </span>
              }
            />
          ))}
        </Group>
      ) : null}

      {filters.map((f) => (
        <Group key={f.name} title={f.name} defaultOpen={false}>
          {f.values.slice(0, 14).map((v) => {
            const key = `attr.${f.name}`;
            return (
              <Checkbox
                key={v.value}
                checked={sp.getAll(key).includes(v.value)}
                onChange={() => toggleMulti(key, v.value)}
                label={
                  <span className="flex items-center gap-2">
                    {v.value}
                    <span className="text-xs text-muted tnum">{v.count}</span>
                  </span>
                }
              />
            );
          })}
        </Group>
      ))}

      {activeCount > 0 ? (
        <div className="py-4">
          <Button variant="ghost" size="sm" icon={<X className="size-4" />} onClick={() => startTransition(() => router.push(pathname, { scroll: false }))}>
            Сбросить фильтры ({activeCount})
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
