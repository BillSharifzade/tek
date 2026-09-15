"use client";

import { useState } from "react";
import { isoDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export interface Period {
  from: string;
  to: string;
}

/** Default period: last N days up to today (ISO dates). */
export function defaultPeriod(days = 30): Period {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - days);
  return { from: isoDate(from), to: isoDate(to) };
}

export const periodKey = (p: Period) => `${p.from}_${p.to}`;

export function periodFromParams(sp: URLSearchParams | null, days = 30): Period {
  const d = defaultPeriod(days);
  const from = sp?.get("from");
  const to = sp?.get("to");
  return { from: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : d.from, to: to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : d.to };
}

export function PeriodFilter({
  value,
  onApply,
  busy,
  right,
}: {
  value: Period;
  onApply: (p: Period) => void;
  busy?: boolean;
  right?: React.ReactNode;
}) {
  // Parents pass `key={periodKey(value)}` so the inputs reset when the applied period changes.
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);

  const invalid = Boolean(from && to && from > to);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid) onApply({ from, to });
      }}
      className="flex flex-wrap items-end gap-3 rounded-[8px] border border-line bg-white p-4"
    >
      <span className="pb-2.5 text-base font-medium">Период</span>
      <label className="flex items-center gap-2 text-sm text-sub">
        с
        <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="w-[160px] tnum" aria-label="Начало периода" invalid={invalid} />
      </label>
      <label className="flex items-center gap-2 text-sm text-sub">
        по
        <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="w-[160px] tnum" aria-label="Конец периода" invalid={invalid} />
      </label>
      <Button type="submit" variant="dark" loading={busy} disabled={invalid}>
        Показать
      </Button>
      {right ? <div className="ml-auto flex items-center gap-2">{right}</div> : null}
    </form>
  );
}
