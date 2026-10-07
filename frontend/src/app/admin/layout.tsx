import type { Metadata } from "next";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminBreadcrumbs, AdminHeading, AdminNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = {
  title: { default: "Панель управления", template: "%s — Панель управления — ТЭК" },
  robots: { index: false, follow: false },
};

/**
 * Каркас панели управления (макета нет — повторяет ЛК, account/layout.tsx): серый фон, крошки «Главная / Панель управления»,
 * заголовок Bold 29/30, слева меню-карточка 246px, справа (через 28px) контент. Доступ — менеджерам и администраторам.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-page pb-[80px]">
      <div className="container-page">
        <AdminBreadcrumbs />
        <AdminHeading />
        <div className="mt-[30px] sm:mt-[42px]">
          <AdminGuard>
            <div className="flex flex-col gap-[16px] lg:flex-row lg:items-start lg:gap-[28px]">
              <AdminNav />
              <div className="min-w-0 flex-1">{children}</div>
            </div>
          </AdminGuard>
        </div>
      </div>
    </div>
  );
}
