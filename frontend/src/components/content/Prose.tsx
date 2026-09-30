import { cn } from "@/lib/cn";

/**
 * Типографика CMS-текстов в языке макета: 16/26 #333, заголовки Roboto 700 чёрные,
 * маркеры списков — серые точки (как «Перечень работ» в 10869:2975), ссылки #1C3697 → #000.
 */
const PROSE = cn(
  "text-[15px] leading-[24px] text-g333 md:text-[16px] md:leading-[26px]",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:mb-[14px]",
  "[&_h2]:mb-[14px] [&_h2]:mt-[36px] [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:leading-[28px] [&_h2]:text-black md:[&_h2]:text-[26px] md:[&_h2]:leading-[30px]",
  "[&_h3]:mb-[10px] [&_h3]:mt-[28px] [&_h3]:text-[18px] [&_h3]:font-bold [&_h3]:leading-[24px] [&_h3]:text-black",
  "[&_h4]:mb-[8px] [&_h4]:mt-[20px] [&_h4]:text-[16px] [&_h4]:font-semibold [&_h4]:text-black",
  "[&_ul]:mb-[14px] [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-[6px]",
  "[&_ul>li]:relative [&_ul>li]:pl-[18px] [&_ul>li]:before:absolute [&_ul>li]:before:left-[4px] [&_ul>li]:before:top-[11px] [&_ul>li]:before:size-[5px] [&_ul>li]:before:rounded-full [&_ul>li]:before:bg-[#B3BAC7] [&_ul>li]:before:content-['']",
  "[&_ol]:mb-[14px] [&_ol]:list-decimal [&_ol]:pl-[22px] [&_ol>li]:mt-[6px]",
  "[&_a]:text-link [&_a]:underline [&_a]:underline-offset-2 [&_a]:transition-colors [&_a:hover]:text-black",
  "[&_strong]:font-semibold [&_strong]:text-black [&_em]:text-sub",
  "[&_table]:mb-[16px] [&_table]:w-full [&_table]:border-collapse [&_th]:bg-[#E5E9F0] [&_th]:px-[12px] [&_th]:py-[10px] [&_th]:text-left [&_th]:font-semibold [&_th]:text-black [&_td]:border-b [&_td]:border-line [&_td]:px-[12px] [&_td]:py-[10px]",
);

/** Renders our own CMS HTML (seeded/backoffice content, not user input). */
export function Prose({ html, className }: { html: string; className?: string }) {
  return <div className={cn(PROSE, className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
