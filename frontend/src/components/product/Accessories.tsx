"use client";

import { useMemo, useState } from "react";
import type { Accessory } from "@/lib/types";
import { Tabs } from "@/components/ui/Tabs";
import { ProductGrid } from "./ProductGrid";
import { ProductCard } from "./ProductCard";

export function Accessories({ items, compact }: { items: Accessory[]; compact?: boolean }) {
  const groups = useMemo(() => {
    const map = new Map<string, Accessory[]>();
    for (const a of items) {
      const arr = map.get(a.group) ?? [];
      arr.push(a);
      map.set(a.group, arr);
    }
    return [...map.entries()];
  }, [items]);
  const [tab, setTab] = useState(groups[0]?.[0] ?? "");
  if (groups.length === 0) return <p className="text-sub">Комплектующие для этого товара не указаны.</p>;
  const current = groups.find(([g]) => g === tab) ?? groups[0];
  const products = current[1].map((a) => a.product);

  return (
    <div>
      <Tabs
        variant="pills"
        value={current[0]}
        onChange={setTab}
        items={groups.map(([g, arr]) => ({ key: g, label: g, count: arr.length }))}
        className="mb-5 max-w-full overflow-x-auto scrollbar-none"
      />
      {compact ? (
        <div className="flex flex-col gap-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} compact />
          ))}
        </div>
      ) : (
        <ProductGrid products={products} cols={5} />
      )}
    </div>
  );
}
