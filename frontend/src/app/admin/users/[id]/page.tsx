import type { Metadata } from "next";
import { UserDetailView } from "@/components/admin/UserDetailView";

export const metadata: Metadata = { title: "Карточка пользователя" };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserDetailView id={id} />;
}
