import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { cn } from "@/lib/cn";

/**
 * Каркас страниц входа/регистрации (макета нет): серый фон ЛК #F4F5F7, крошки как на остальных страницах
 * (y=157), по центру — белая карточка (рамка #E5E5E5, r10), заголовок 26 Bold.
 */
export function AuthShell({ crumb, title, subtitle, width = 440, children, footer }: { crumb: string; title: string; subtitle?: React.ReactNode; width?: 440 | 640; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="bg-page pb-[80px]">
      <div className="container-page">
        <Breadcrumbs items={[{ label: crumb }]} className="pt-[43px]" />
        <div className={cn("mx-auto mt-[30px] w-full sm:mt-[40px]", width === 640 ? "max-w-[640px]" : "max-w-[440px]")}>
          <div className="rounded-[10px] border border-line bg-white px-[20px] pb-[28px] pt-[28px] sm:px-[40px] sm:pb-[40px] sm:pt-[38px]">
            <h1 className="text-[22px] font-bold leading-[26px] sm:text-[26px] sm:leading-[30px]">{title}</h1>
            {subtitle ? <p className="mt-[8px] text-[14px] leading-[20px] text-sub">{subtitle}</p> : null}
            <div className="mt-[26px]">{children}</div>
          </div>
          {footer}
        </div>
      </div>
    </div>
  );
}

/** Error / notice block shared by the auth forms. */
export function AuthAlert({ title, text, tone = "error" }: { title: string; text?: React.ReactNode; tone?: "error" | "info" }) {
  return (
    <div role="alert" className={cn("rounded-[7px] px-[14px] py-[10px] text-[14px] leading-[20px]", tone === "error" ? "bg-sale-bg" : "bg-brand-light")}>
      <p className={cn("font-medium", tone === "error" ? "text-sale-text" : "text-black")}>{title}</p>
      {text ? <p className="mt-[2px] text-g333">{text}</p> : null}
    </div>
  );
}
