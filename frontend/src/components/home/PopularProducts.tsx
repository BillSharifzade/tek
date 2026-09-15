"use client";

import { useState } from "react";
import type { ProductCard as ProductCardT } from "@/lib/types";
import { Tabs } from "@/components/ui/Tabs";
import { ProductGrid } from "@/components/product/ProductGrid";

export function PopularProducts({ popular, fresh }: { popular: ProductCardT[]; fresh: ProductCardT[] }) {
  const [tab, setTab] = useState<"popular" | "new">("popular");
  const items = tab === "popular" ? popular : fresh;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">Популярные товары</h2>
        <Tabs
          variant="pills"
          value={tab}
          onChange={setTab}
          items={[
            { key: "popular", label: "Популярное" },
            { key: "new", label: "Новое" },
          ]}
        />
      </div>
      {items.length > 0 ? <ProductGrid products={items.slice(0, 10)} cols={5} /> : <p className="text-sub">Товары появятся совсем скоро.</p>}
    </div>
  );
}
