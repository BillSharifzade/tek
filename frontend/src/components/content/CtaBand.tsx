import { Phone } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/cn";

export function CtaBand({
  title = "Нужна консультация?",
  text = "Инженеры ТЭК помогут подобрать оборудование, рассчитать кабеленесущие системы и подготовить спецификацию.",
  className,
}: {
  title?: string;
  text?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6 rounded-[8px] bg-ink px-6 py-8 text-white md:flex-row md:items-center md:justify-between md:px-10", className)}>
      <div className="max-w-xl">
        <h2 className="text-white">{title}</h2>
        <p className="mt-2 text-base text-white/70">{text}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <a href={SITE.phoneHref} className="inline-flex items-center gap-2 text-xl font-semibold text-brand hover:text-brand-hover">
          <Phone className="size-5" />
          {SITE.phone}
        </a>
        <ButtonLink href="/contacts" size="lg">
          Контакты
        </ButtonLink>
      </div>
    </div>
  );
}
