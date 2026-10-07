import type { Metadata } from "next";
import { SellerProductCreateView } from "@/features/sellerProducts/SellerProductCreateView";

export const metadata: Metadata = { title: "افزودن محصول" };

export default function NewSellerProductPage() {
  return <SellerProductCreateView />;
}
