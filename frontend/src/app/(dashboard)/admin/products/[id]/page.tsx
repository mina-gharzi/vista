import type { Metadata } from "next";
import { AdminProductDetailView } from "@/features/admin/AdminProductDetailView";

export const metadata: Metadata = { title: "جزئیات محصول" };

export default function Page({ params }: { params: { id: string } }) {
  return <AdminProductDetailView productId={params.id} />;
}
