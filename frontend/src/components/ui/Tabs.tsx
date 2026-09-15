"use client";

import { cn } from "@/lib/cn";

export interface TabItem<K extends string = string> {
  key: K;
  label: React.ReactNode;
  count?: number;
  disabled?: boolean;
}

export interface TabsProps<K extends string = string> {
  items: TabItem<K>[];
  value: K;
  onChange: (k: K) => void;
  /** "underline" (section tabs) | "pills" (Популярное / Новое) */
  variant?: "underline" | "pills";
  className?: string;
}

export function Tabs<K extends string = string>({ items, value, onChange, variant = "underline", className }: TabsProps<K>) {
  if (variant === "pills") {
    return (
      <div role="tablist" className={cn("inline-flex items-center gap-1 rounded-[8px] bg-surface p-1", className)}>
        {items.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={value === t.key}
            disabled={t.disabled}
            onClick={() => onChange(t.key)}
            className={cn(
              "h-8 rounded-[6px] px-4 text-base font-medium transition-colors",
              value === t.key ? "bg-white text-ink shadow-sm" : "text-sub hover:text-ink",
            )}
          >
            {t.label}
            {t.count !== undefined ? <span className="ml-1 text-sub">({t.count})</span> : null}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div role="tablist" className={cn("flex items-end gap-8 overflow-x-auto scrollbar-none border-b border-line", className)}>
      {items.map((t) => (
        <button
          key={t.key}
          role="tab"
          type="button"
          aria-selected={value === t.key}
          disabled={t.disabled}
          onClick={() => onChange(t.key)}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 pb-3 pt-1 text-md font-medium transition-colors",
            value === t.key ? "border-brand text-ink" : "border-transparent text-sub hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined ? <span className="ml-1.5 text-sub">({t.count})</span> : null}
        </button>
      ))}
    </div>
  );
}
