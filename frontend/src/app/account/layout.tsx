import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { AccountGuard } from "@/components/account/AccountGuard";
import { AccountHeading, AccountNav } from "@/components/account/AccountNav";

export const metadata: Metadata = {
  title: { default: "Личный кабинет", template: "%s — Личный кабинет — ТЭК" },
};

/**
 * Каркас ЛК (Figma 9063:200 / 9085:409): серый фон #F4F5F7 под шапкой, крошки «Главная / Мой кабинет» (11px #8F8F8F),
 * заголовок Bold 29/30, слева меню-карточка 246px, справа (через 28px) контент.
 * Крошки стоят на той же высоте, что и на остальных страницах (y=157); от центра крошек до центра заголовка — 35px,
 * от низа заголовка до меню и карточек — 42px (как в макете).
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-page pb-[80px]">
      <div className="container-page">
        <Breadcrumbs items={[{ label: "Мой кабинет" }]} separator="/" className="pt-[43px] text-[11px] leading-[15px] text-[#8F8F8F]" />
        <AccountHeading />
        <div className="mt-[30px] sm:mt-[42px]">
          <AccountGuard>
            <div className="flex flex-col gap-[16px] lg:flex-row lg:items-start lg:gap-[28px]">
              <AccountNav />
              <div className="min-w-0 flex-1">{children}</div>
            </div>
          </AccountGuard>
        </div>
      </div>
    </div>
  );
}
