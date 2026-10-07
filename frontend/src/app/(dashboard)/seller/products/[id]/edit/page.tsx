import type { Metadata } from "next";
import { SellerProductEditView } from "@/features/sellerProducts/SellerProductEditView";

export const metadata: Metadata = { title: "ویرایش محصول" };

export default function EditSellerProductPage({ params }: { params: { id: string } }) {
  return <SellerProductEditView productId={params.id} />;
}
