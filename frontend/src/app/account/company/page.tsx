import type { Metadata } from "next";
import { CompanyView } from "@/components/account/CompanyView";

export const metadata: Metadata = { title: "Данные компании" };

export default function CompanyPage() {
  return <CompanyView />;
}
