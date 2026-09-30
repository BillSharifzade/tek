import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { AccountGuard } from "@/components/account/AccountGuard";
import { AccountHeading, AccountNav } from "@/components/account/AccountNav";

export const metadata: Metadata = {
  title: { default: "Личный кабинет", template: "%s — Личный кабинет — ТЭК" },
};

/**
 * Каркас ЛК (Figma 9063:200): серый фон #F4F5F7 под шапкой, крошки, заголовок,
 * слева меню-карточка 246px, справа (через 28px) контент.
 * Отступы по вертикали — как на остальных страницах (крошки y=157, заголовок y=188, контент y=247).
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-page pb-[80px]">
      <div className="container-page">
        <Breadcrumbs items={[{ label: "Мой кабинет" }]} className="pt-[43px]" />
        <AccountHeading />
        <div className="mt-[30px] sm:mt-[40px]">
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
