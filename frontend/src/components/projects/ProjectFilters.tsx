import Link from "next/link";
import { cn } from "@/lib/cn";

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export interface FilterGroup {
  /** query-параметр (brand / service) */
  param: string;
  title: string;
  options: FilterOption[];
  active: string | null;
}

/** Пилюля фильтра из макета: 32px, r7, текст 13/18; активная — #FFCC33, остальные — #EEF0F2. */
function Pill({ href, active, children, title }: { href: string; active: boolean; children: React.ReactNode; title?: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      prefetch={false}
      aria-current={active ? "true" : undefined}
      title={title}
      className={cn(
        "block h-[32px] whitespace-nowrap rounded-[7px] px-[18.5px] pt-[8px] text-center text-[13px] leading-[18px] text-black transition-colors",
        active ? "bg-brand hover:bg-brand-hover" : "bg-btn hover:bg-btn-hover",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Белая карточка фильтров «Вендоры» / «Продукция» (Figma 10633:1471): 1259×160, r10, поля 22/30/30,
 * вторая колонка начинается через 664px. Фильтры — ссылки (?brand=…&service=…), поэтому работают и без JS.
 */
export function ProjectFilters({ groups, hrefFor }: { groups: FilterGroup[]; hrefFor: (param: string, value: string | null) => string }) {
  const visible = groups.filter((g) => g.options.length > 0);
  if (visible.length === 0) return null;
  return (
    <section aria-label="Фильтры проектов" className="grid gap-y-[24px] rounded-[10px] bg-white px-[20px] pb-[30px] pt-[22px] sm:px-[30px] lg:grid-cols-2 lg:gap-x-[69px]">
      {visible.map((g) => (
        <div key={g.param} className="min-w-0">
          <h2 className="text-[16px] font-semibold leading-[20px] text-black">{g.title}</h2>
          <ul className="mt-[16px] flex flex-wrap gap-[8px]">
            <li>
              <Pill href={hrefFor(g.param, null)} active={g.active === null}>
                Все
              </Pill>
            </li>
            {g.options.map((o) => (
              <li key={o.value}>
                <Pill href={hrefFor(g.param, o.value)} active={g.active === o.value} title={`${o.label}: ${o.count}`}>
                  {o.label}
                </Pill>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
