"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CategoryNode, ProductCard } from "@/lib/types";
import { client } from "@/lib/client";
import { cn } from "@/lib/cn";
import { countLabel } from "@/lib/format";
import { useFavorites } from "@/store/favorites";
import { ProductGrid } from "@/components/product/ProductGrid";
import { GridSkeleton } from "@/components/ui/Skeleton";
import { Card, CardTitle, EmptyState, ErrorLine, errorMessage } from "./shared";

/** Корневой раздел каталога для каждого раздела дерева (slug → корень). */
function rootsBySlug(tree: CategoryNode[]): Map<string, { slug: string; name: string }> {
  const out = new Map<string, { slug: string; name: string }>();
  const walk = (n: CategoryNode, root: { slug: string; name: string }) => {
    out.set(n.slug, root);
    n.children.forEach((c) => walk(c, root));
  };
  tree.forEach((r) => walk(r, { slug: r.slug, name: r.name }));
  return out;
}

/**
 * «Избранное» (макета нет): белая карточка ЛК с сеткой карточек товара (4 × 226px). Доработки R5:
 * товар, убранный из избранного, остаётся в списке с неактивным серым сердцем до перезагрузки страницы (можно вернуть);
 * над списком — фильтр по корневым разделам каталога, как у Петровича.
 */
export function FavoritesView() {
  const ids = useFavorites((s) => s.ids);
  const hydrate = useFavorites((s) => s.hydrate);
  const list = useFavorites((s) => s.list);
  const [items, setItems] = useState<ProductCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roots, setRoots] = useState<Map<string, { slug: string; name: string }> | null>(null);
  const [root, setRoot] = useState<string | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // список загружается один раз: снятые с избранного товары не пропадают, пока страницу не обновят
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
  }, [list]);

  useEffect(() => {
    let cancelled = false;
    client
      .get<CategoryNode[]>("/catalog/tree")
      .then((t) => {
        if (!cancelled) setRoots(rootsBySlug(t));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const chips = useMemo(() => {
    if (!items || !roots) return [];
    const seen = new Map<string, { slug: string; name: string; count: number }>();
    for (const p of items) {
      const r = p.category ? roots.get(p.category.slug) : undefined;
      if (!r) continue;
      const cur = seen.get(r.slug);
      seen.set(r.slug, { ...r, count: (cur?.count ?? 0) + 1 });
    }
    return [...seen.values()];
  }, [items, roots]);

  const active = chips.some((c) => c.slug === root) ? root : null;
  const shown = items && active && roots ? items.filter((p) => p.category && roots.get(p.category.slug)?.slug === active) : items;
  const favCount = items ? items.filter((p) => ids.includes(p.id)).length : 0;

  return (
    <Card className="xl:px-[20px]">
      <CardTitle className="xl:px-[10px]" right={items ? <span className="text-[15px] leading-[20px] text-[#555]">{countLabel(favCount, ["товар", "товара", "товаров"])}</span> : null}>
        Избранное
      </CardTitle>
      <ErrorLine error={error} className="mt-[20px]" />
      {chips.length > 1 ? (
        <ul className="mt-[20px] flex flex-wrap gap-[4px] xl:px-[10px]" aria-label="Разделы каталога">
          {chips.map((c) => {
            const on = c.slug === active;
            return (
              <li key={c.slug}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setRoot(on ? null : c.slug)}
                  className={cn("h-[32px] rounded-[5px] px-[12px] text-[13px] leading-[12px] text-black transition-colors", on ? "bg-brand hover:bg-brand-hover" : "bg-btn hover:bg-btn-hover")}
                >
                  {c.name}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {shown === null && !error ? (
        <div className="mt-[24px]">
          <GridSkeleton count={4} cols={4} />
        </div>
      ) : shown && shown.length === 0 ? (
        <EmptyState className="mt-[21px]">
          В избранном пока пусто. Нажимайте на сердечко в карточке товара, чтобы сохранить его.{" "}
          <Link href="/catalog" className="text-black underline underline-offset-[3px]">
            Перейти в каталог
          </Link>
        </EmptyState>
      ) : shown ? (
        <ProductGrid products={shown} cols={4} className="mt-[24px]" />
      ) : null}
    </Card>
  );
}
