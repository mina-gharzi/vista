import type { Metadata } from "next";
import { AdminOrderDetailView } from "@/features/admin/AdminOrderDetailView";

export const metadata: Metadata = { title: "جزئیات سفارش (مدیریت)" };

export default function Page({ params }: { params: { id: string } }) {
  return <AdminOrderDetailView orderId={params.id} />;
}
