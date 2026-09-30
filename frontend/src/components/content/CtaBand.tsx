import { ButtonLink } from "@/components/ui/Button";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/cn";

/**
 * «Нужна консультация?» — серая плашка #F7F8F9 r11 (как блоки лендинга/ДГУ), заголовок 26 Bold,
 * текст 16/26 #333, справа телефон и жёлтая кнопка 54px (как «Оставить заявку» в 10869:2975).
 */
export function CtaBand({
  title = "Нужна консультация?",
  text = "Подробно расскажем об оборудовании и услугах, рассчитаем стоимость и подготовим индивидуальное предложение.",
  cta = "Задать вопрос",
  href = "/contacts#feedback",
  className,
}: {
  title?: string;
  text?: string;
  cta?: string;
  href?: string;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-[24px] rounded-[11px] bg-surface-2 px-[24px] py-[28px] md:flex-row md:items-center md:justify-between md:px-[62px] md:py-[44px]", className)}>
      <div className="max-w-[640px]">
        <h2 className="text-[22px] font-bold leading-[28px] md:text-[26px] md:leading-[30px]">{title}</h2>
        <p className="mt-[10px] text-[15px] leading-[24px] text-g333 md:text-[16px] md:leading-[26px]">{text}</p>
      </div>
      <div className="flex flex-col gap-[20px] sm:flex-row sm:items-center md:gap-[32px]">
        <div className="flex flex-col">
          <a href={SITE.phoneHref} className="link-hover text-[20px] font-bold leading-[24px] text-black tnum">
            {SITE.phone}
          </a>
          <span className="mt-[4px] text-[13px] leading-[18px] text-muted">{SITE.hours}</span>
        </div>
        <ButtonLink href={href} size="lg" className="px-[24px]">
          {cta}
        </ButtonLink>
      </div>
    </section>
  );
}
