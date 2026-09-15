"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { SORT_OPTIONS } from "@/lib/site";
import { Select } from "@/components/ui/Select";

export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const value = sp.get("sort") ?? "popular";
  return (
    <label className="flex items-center gap-2 text-sm text-sub">
      <span className="hidden sm:inline">Сортировка:</span>
      <Select
        options={SORT_OPTIONS}
        value={value}
        aria-label="Сортировка"
        className="w-[190px]"
        onChange={(e) => {
          const p = new URLSearchParams(sp.toString());
          if (e.target.value === "popular") p.delete("sort");
          else p.set("sort", e.target.value);
          p.delete("page");
          const s = p.toString();
          startTransition(() => router.push(s ? `${pathname}?${s}` : pathname, { scroll: false }));
        }}
      />
    </label>
  );
}
