import type { Metadata } from "next";
import { EstimatesView } from "@/components/account/EstimatesView";

export const metadata: Metadata = { title: "Сметы" };

export default function EstimatesPage() {
  return <EstimatesView />;
}
