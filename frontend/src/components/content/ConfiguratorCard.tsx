import Link from "next/link";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";
import { imageOf, type ConfiguratorItem } from "./types";

/** Карточка конфигуратора: серая плашка #F7F8F9 r11 (как сервисные плитки лендинга), иллюстрация справа, жёлтая кнопка. */
export function ConfiguratorCard({ item }: { item: ConfiguratorItem }) {
  const img = imageOf(item);
  return (
    <article className="group relative flex h-full flex-col-reverse overflow-hidden rounded-[11px] bg-surface-2 transition-shadow hover:shadow-pop sm:flex-row">
      <div className="flex flex-1 flex-col px-[24px] pb-[24px] pt-[22px] md:px-[34px] md:pb-[32px] md:pt-[30px]">
        <span className="inline-flex h-[24px] items-center self-start rounded-[15px] bg-white px-[11px] text-[13px] leading-[18px] text-g333">Онлайн-конфигуратор</span>
        <h3 className="mt-[14px] text-[20px] font-bold leading-[26px] md:text-[22px] md:leading-[28px]">
          <Link href={item.url} className="after:absolute after:inset-0 after:content-['']">
            {item.name}
          </Link>
        </h3>
        <p className="mt-[10px] flex-1 text-[15px] leading-[23px] text-g333">{item.description}</p>
        <div className="relative z-10 mt-[22px]">
          <ButtonLink href={item.url} className="px-[24px]">
            Открыть конфигуратор
          </ButtonLink>
        </div>
      </div>
      {img ? (
        <div className="relative h-[180px] shrink-0 bg-[#F6F6F6] sm:h-auto sm:w-[38%]">
          <Image src={img} alt="" fill unoptimized sizes="240px" className="object-contain p-[12px] transition-transform duration-300 group-hover:scale-105" />
        </div>
      ) : null}
    </article>
  );
}
