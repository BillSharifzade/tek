import type { Metadata } from "next";
import { StoresAdminView } from "@/components/admin/StoresAdminView";

export const metadata: Metadata = { title: "Магазины и склады" };

export default function AdminStoresPage() {
  return <StoresAdminView />;
}
