"use client";

import { client } from "@/lib/client";
import type { CategoryNode } from "@/lib/types";
import { useLoad } from "./shared";

export interface RefOption {
  slug: string;
  name: string;
}

function flatten(nodes: CategoryNode[], prefix = ""): RefOption[] {
  return nodes.flatMap((n) => {
    const name = prefix ? `${prefix} / ${n.name}` : n.name;
    return [{ slug: n.slug, name }, ...flatten(n.children, name)];
  });
}

/** Справочники каталога для подсказок в фильтрах и правилах цен: категории (с путём «A / B») и бренды. */
export function useCatalogRefs() {
  const categories = useLoad("refs:categories", () => client.get<CategoryNode[]>("/catalog/tree").then((t) => flatten(t)));
  const brands = useLoad("refs:brands", () => client.get<{ slug: string; name: string }[]>("/brands").then((b) => b.map(({ slug, name }) => ({ slug, name }))));
  return { categories: categories.data ?? [], brands: brands.data ?? [] };
}
