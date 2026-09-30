import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { FavoritesView } from "@/components/account/FavoritesView";

export const metadata: Metadata = { title: "Избранное", robots: { index: false } };

/** Избранное без входа: гость видит товары, сохранённые в браузере (после входа они переносятся в аккаунт). */
export default function GuestFavoritesPage() {
  return (
    <div className="bg-page pb-[80px]">
      <div className="container-page">
        <Breadcrumbs items={[{ label: "Избранное" }]} className="pt-[43px]" />
        <div className="mt-[30px] sm:mt-[40px]">
          <FavoritesView />
        </div>
      </div>
    </div>
  );
}
