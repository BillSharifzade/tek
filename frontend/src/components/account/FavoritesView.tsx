"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProductCard } from "@/lib/types";
import { countLabel } from "@/lib/format";
import { useFavorites } from "@/store/favorites";
import { ProductGrid } from "@/components/product/ProductGrid";
import { GridSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorLine, PageTitle, errorMessage } from "./shared";

export function FavoritesView() {
  const ids = useFavorites((s) => s.ids);
  const hydrate = useFavorites((s) => s.hydrate);
  const list = useFavorites((s) => s.list);
  const [items, setItems] = useState<ProductCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    let cancelled = false;
    list()
      .then((p) => {
        if (!cancelled) setItems(p);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e, "Не удалось загрузить избранное"));
      });
    return () => {
      cancelled = true;
    };
  }, [list, ids.length]);

  const visible = items?.filter((p) => ids.includes(p.id)) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <PageTitle right={visible ? <span className="text-sm text-sub">{countLabel(visible.length, ["товар", "товара", "товаров"])}</span> : null}>Избранное</PageTitle>
      <ErrorLine error={error} />
      {visible === null && !error ? (
        <GridSkeleton count={6} cols={4} />
      ) : visible && visible.length === 0 ? (
        <EmptyState>
          В избранном пока пусто. Нажимайте на сердечко в карточке товара, чтобы сохранить его.{" "}
          <Link href="/catalog" className="text-info hover:underline">
            Перейти в каталог
          </Link>
        </EmptyState>
      ) : visible ? (
        <ProductGrid products={visible} cols={4} />
      ) : null}
    </div>
  );
}
