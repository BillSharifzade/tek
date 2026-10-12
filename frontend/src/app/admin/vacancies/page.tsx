import type { Metadata } from "next";
import { VacanciesAdminView } from "@/components/admin/VacanciesAdminView";

export const metadata: Metadata = { title: "Вакансии" };

export default function AdminVacanciesPage() {
  return <VacanciesAdminView />;
}
