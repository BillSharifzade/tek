"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProductCard } from "@/lib/types";
import { countLabel } from "@/lib/format";
import { useFavorites } from "@/store/favorites";
import { ProductGrid } from "@/components/product/ProductGrid";
import { GridSkeleton } from "@/components/ui/Skeleton";
import { Card, CardTitle, EmptyState, ErrorLine, errorMessage } from "./shared";

/** «Избранное» (макета нет): белая карточка ЛК с сеткой карточек товара (4 × 226px). */
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
    <Card className="xl:px-[20px]">
      <CardTitle className="xl:px-[10px]" right={visible ? <span className="text-[14px] leading-[20px] text-sub">{countLabel(visible.length, ["товар", "товара", "товаров"])}</span> : null}>
        Избранное
      </CardTitle>
      <ErrorLine error={error} className="mt-[20px]" />
      {visible === null && !error ? (
        <div className="mt-[24px]">
          <GridSkeleton count={4} cols={4} />
        </div>
      ) : visible && visible.length === 0 ? (
        <EmptyState className="mt-[21px]">
          В избранном пока пусто. Нажимайте на сердечко в карточке товара, чтобы сохранить его.{" "}
          <Link href="/catalog" className="text-black underline underline-offset-[3px]">
            Перейти в каталог
          </Link>
        </EmptyState>
      ) : visible ? (
        <ProductGrid products={visible} cols={4} className="mt-[24px]" />
      ) : null}
    </Card>
  );
}
