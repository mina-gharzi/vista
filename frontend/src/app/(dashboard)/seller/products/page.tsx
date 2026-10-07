import type { Metadata } from "next";
import { SellerProductsView } from "@/features/sellerProducts/SellerProductsView";

export const metadata: Metadata = { title: "محصولات من" };

export default function SellerProductsPage() {
  return <SellerProductsView />;
}
