import type { Metadata } from "next";
import { FavoritesView } from "@/components/account/FavoritesView";

export const metadata: Metadata = { title: "Избранное" };

export default function FavoritesPage() {
  return <FavoritesView />;
}
