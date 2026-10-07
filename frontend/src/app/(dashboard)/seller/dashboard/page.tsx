import type { Metadata } from "next";
import { SellerDashboardView } from "@/features/sellerDashboard/SellerDashboardView";

export const metadata: Metadata = { title: "داشبورد فروشنده" };

export default function SellerDashboardPage() {
  return <SellerDashboardView />;
}
