import type { Metadata } from "next";
import { SellerOrdersView } from "@/features/sellerOrders/SellerOrdersView";

export const metadata: Metadata = { title: "سفارش‌ها" };

export default function SellerOrdersPage() {
  return <SellerOrdersView />;
}
