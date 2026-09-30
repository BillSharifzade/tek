import { Headset, ShieldCheck, Truck, Wrench, type LucideIcon } from "lucide-react";
import type { Usp } from "@/lib/types";

const ICONS: Record<string, LucideIcon> = {
  truck: Truck,
  delivery: Truck,
  headset: Headset,
  support: Headset,
  shield: ShieldCheck,
  check: ShieldCheck,
  wrench: Wrench,
  service: Wrench,
};
const FALLBACK: LucideIcon[] = [Truck, Headset, ShieldCheck, Wrench];

/** «Бережно доставляем» + « товары по Таджикистану…»: первые два слова — акцент (500, #000), остальное — #666. Пояснение `text` — в подсказке. */
function split(u: Usp): [string, string] {
  const words = u.title.trim().split(/\s+/);
  const lead = words.slice(0, 2).join(" ");
  return [lead, words.slice(2).join(" ")];
}

/** Ряд из 4 преимуществ (Figma 10999:2852): блоки 262 с шагом 332, иконка 48×48, текст 200px 14/17. */
export function UspRow({ items }: { items: Usp[] }) {
  if (items.length === 0) return null;
  return (
    <section className="container-page mt-10 lg:mt-[60px]" aria-label="Преимущества">
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:mx-px xl:grid-cols-4 xl:gap-x-[70px]">
        {items.slice(0, 4).map((u, i) => {
          const Icon = ICONS[u.icon] ?? FALLBACK[i % FALLBACK.length];
          const [lead, rest] = split(u);
          return (
            <li key={u.title} className="flex items-start gap-[14px] xl:h-[51px]">
              <Icon className="mt-px size-12 shrink-0 text-[#414141]" strokeWidth={1.5} aria-hidden />
              <p className="line-clamp-3 w-[200px] min-w-0 text-[14px] leading-[17px] text-sub" title={u.text || undefined}>
                <span className="font-medium text-black">{lead}</span>
                {rest ? ` ${rest}` : null}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
