import type { Metadata } from "next";
import { SellerOrderDetailView } from "@/features/sellerOrders/SellerOrderDetailView";

export const metadata: Metadata = { title: "جزئیات سفارش" };

export default function SellerOrderDetailPage({ params }: { params: { id: string } }) {
  return <SellerOrderDetailView sellerOrderId={params.id} />;
}
