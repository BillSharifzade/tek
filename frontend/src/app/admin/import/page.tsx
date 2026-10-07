import type { Metadata } from "next";
import { ImportView } from "@/components/admin/ImportView";

export const metadata: Metadata = { title: "Импорт каталога" };

export default function AdminImportPage() {
  return <ImportView />;
}
