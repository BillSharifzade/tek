import Link from "next/link";
import type { ReactNode } from "react";
import { IconArrowSmall } from "./icons";

const LINKS = [
  { href: "/catalog", title: "Каталог", text: "Кабели, лотки, светотехника, генераторы" },
  { href: "/services", title: "Услуги", text: "Сервис ДГУ, солнечные станции, проектирование" },
  { href: "/projects", title: "Проекты", text: "Реализованные объекты по всему Таджикистану" },
  { href: "/contacts", title: "Контакты", text: "Адреса, телефоны и режим работы" },
];

/**
 * Экран 404 / ошибки: серая плашка #F7F8F9 r11 как первый экран «Сервис центр ДГУ» (заголовок 40/52 Bold,
 * текст 16/26 #333, кнопки 54px), справа — крупный код на жёлтом круге; ниже — плитки разделов.
 */
export function StatusScreen({ code, title, text, actions, note }: { code: string; title: string; text: ReactNode; actions: ReactNode; note?: ReactNode }) {
  return (
    <div className="container-page pb-[64px] pt-[24px] md:pb-[100px] md:pt-[43px]">
      <section className="grid overflow-hidden rounded-[11px] bg-surface-2 md:grid-cols-[minmax(0,1fr)_420px] lg:min-h-[420px]">
        <div className="px-[20px] py-[32px] md:px-[62px] md:py-[60px]">
          <span className="inline-flex h-[25px] items-center rounded-[7px] bg-brand px-[8px] text-[14px] font-semibold leading-[13px] text-g333">{code === "404" ? "Ошибка 404" : "Ошибка"}</span>
          <h1 className="mt-[18px] text-[28px] font-bold leading-[36px] md:text-[40px] md:leading-[52px]">{title}</h1>
          <div className="mt-[14px] max-w-[520px] text-[15px] leading-[24px] text-g333 md:text-[16px] md:leading-[26px]">{text}</div>
          {note}
          <div className="mt-[28px] flex flex-wrap gap-[12px] md:mt-[36px]">{actions}</div>
        </div>
        <div className="relative hidden items-center justify-center md:flex" aria-hidden>
          <span className="absolute size-[300px] rounded-full bg-brand/90" />
          <span className="relative text-[120px] font-bold leading-none tracking-[-4px] text-black tnum">{code}</span>
        </div>
      </section>

      <ul className="mt-[24px] grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-4 lg:gap-[16px]">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="group flex h-full items-center justify-between gap-[16px] rounded-[8px] bg-surface-2 px-[24px] py-[22px] transition-shadow hover:shadow-soft">
              <span>
                <span className="block text-[16px] font-bold leading-[20px] text-black">{l.title}</span>
                <span className="mt-[5px] block text-[14px] leading-[17px] text-sub">{l.text}</span>
              </span>
              <IconArrowSmall className="size-[14px] shrink-0 text-sub transition-colors group-hover:text-black" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
