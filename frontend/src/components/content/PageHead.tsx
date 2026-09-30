import type { ReactNode } from "react";
import { Breadcrumbs, type CrumbItem } from "@/components/ui/Breadcrumbs";
import { cn } from "@/lib/cn";

/**
 * Шапка контентной страницы в языке макета: хлебные крошки на y=157 (43px под линией шапки,
 * как в «Каталоге» 10683:1085), под ними H1 Roboto 700 32px (как заголовки секций «Сервис центр ДГУ»).
 */
export function PageHead({
  crumbs,
  title,
  aside,
  children,
  className,
}: {
  crumbs: CrumbItem[];
  title: ReactNode;
  /** справа от заголовка (счётчик, ссылка) */
  aside?: ReactNode;
  /** лид / подзаголовок под H1 */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("pt-[24px] md:pt-[43px]", className)}>
      <Breadcrumbs items={crumbs} />
      <div className="mt-[12px] flex flex-wrap items-end justify-between gap-x-6 gap-y-2 md:mt-[11px]">
        <h1 className="text-[26px] font-bold leading-[32px] md:text-[32px] md:leading-[38px]">{title}</h1>
        {aside}
      </div>
      {children}
    </div>
  );
}

/** Заголовок секции: Roboto 700 26px (мобайл 22px). */
export function SectionTitle({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <h2 id={id} className={cn("text-[22px] font-bold leading-[28px] md:text-[26px] md:leading-[30px]", className)}>
      {children}
    </h2>
  );
}

/** Лид под заголовком: 16/26 #333. */
export function Lead({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[15px] leading-[24px] text-g333 md:text-[16px] md:leading-[26px]", className)}>{children}</p>;
}
