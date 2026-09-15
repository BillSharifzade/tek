import type { Metadata } from "next";
import { PersonalView } from "@/components/account/PersonalView";

export const metadata: Metadata = { title: "Личные данные" };

export default function PersonalPage() {
  return <PersonalView />;
}
