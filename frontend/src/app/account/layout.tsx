import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { AccountGuard } from "@/components/account/AccountGuard";
import { AccountNav } from "@/components/account/AccountNav";

export const metadata: Metadata = {
  title: { default: "Личный кабинет", template: "%s — Личный кабинет — ТЭК" },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page pb-14">
      <Breadcrumbs items={[{ label: "Мой кабинет" }]} separator="/" />
      <h1 className="mb-6">Личный кабинет пользователя</h1>
      <AccountGuard>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <AccountNav />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </AccountGuard>
    </div>
  );
}
