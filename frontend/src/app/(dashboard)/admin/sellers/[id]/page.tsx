import type { Metadata } from "next";
import { AdminSellerDetailView } from "@/features/admin/AdminSellerDetailView";

export const metadata: Metadata = { title: "جزئیات فروشنده" };

export default function Page({ params }: { params: { id: string } }) {
  return <AdminSellerDetailView sellerId={params.id} />;
}
