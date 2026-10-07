import Image from "next/image";
import type { Usp } from "@/lib/types";

/** Иконки 46×46 из Figma «Краткие факты» (редакция 06.10) — по ключу `icon` из CMS. */
const ICONS: Record<string, string> = {
  assortment: "/figma/icons/usp-assortment.svg",
  truck: "/figma/icons/usp-delivery.svg",
  delivery: "/figma/icons/usp-delivery.svg",
  support: "/figma/icons/usp-support.svg",
  headset: "/figma/icons/usp-support.svg",
  account: "/figma/icons/usp-account.svg",
};
const FALLBACK = ["/figma/icons/usp-assortment.svg", "/figma/icons/usp-delivery.svg", "/figma/icons/usp-support.svg", "/figma/icons/usp-account.svg"];

/** Положение в макете: текст 190–193 шириной, иконка на 2–3px ниже верха текста. */
const TEXT_W = ["w-[193px]", "w-[190px]", "w-[191px]", "w-[191px]"];
const ICON_TOP = ["mt-[3px]", "mt-[2px]", "mt-[2px]", "mt-[3px]"];

/**
 * «Большой ассортимент **оригинальных товаров** от мировых брендов»: фрагмент в ** — акцент (500, #000), остальное 14/17 #666.
 * Без разметки (старые тексты) акцент — первые два слова.
 */
function rich(title: string): React.ReactNode {
  if (title.includes("**")) return title.split("**").map((part, i) => (i % 2 ? <span key={i} className="font-medium text-black">{part}</span> : part));
  const words = title.trim().split(/\s+/);
  const rest = words.slice(2).join(" ");
  return (
    <>
      <span className="font-medium text-black">{words.slice(0, 2).join(" ")}</span>
      {rest ? ` ${rest}` : null}
    </>
  );
}

/**
 * Ряд из 4 преимуществ (Figma «Краткие факты» 10999:2852, редакция 06.10): иконки 46×46 с x = 127 / 455 / 787 / 1119,
 * текст через 18px после иконки, 14/17.
 */
export function UspRow({ items }: { items: Usp[] }) {
  if (items.length === 0) return null;
  return (
    <section className="container-page mt-10 lg:mt-[60px]" aria-label="Преимущества">
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:ml-px xl:grid-cols-[328px_332px_332px_minmax(0,1fr)] xl:gap-0">
        {items.slice(0, 4).map((u, i) => (
          <li key={u.title} className="flex items-start gap-[18px] xl:h-[51px]">
            <Image src={ICONS[u.icon] ?? FALLBACK[i % FALLBACK.length]} alt="" width={46} height={46} className={`size-[46px] shrink-0 ${ICON_TOP[i]}`} />
            <p className={`line-clamp-3 min-w-0 text-[14px] leading-[17px] text-sub ${TEXT_W[i]}`} title={u.text || undefined}>
              {rich(u.title)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
