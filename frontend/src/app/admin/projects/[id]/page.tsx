import type { Metadata } from "next";
import { ProjectEditView } from "@/components/admin/ProjectsAdminView";

export const metadata: Metadata = { title: "Проект" };

export default async function AdminProjectItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectEditView id={id} />;
}
