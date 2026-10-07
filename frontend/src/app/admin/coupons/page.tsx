import type { Metadata } from "next";
import { CouponsView } from "@/components/admin/CouponsView";

export const metadata: Metadata = { title: "Купоны" };

export default function AdminCouponsPage() {
  return <CouponsView />;
}
