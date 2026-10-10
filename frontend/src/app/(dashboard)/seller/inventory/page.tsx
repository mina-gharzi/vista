import type { Metadata } from "next";
import { SellerInventoryView } from "@/features/sellerInventory/SellerInventoryView";

export const metadata: Metadata = { title: "موجودی انبار" };

export default function SellerInventoryPage() {
  return <SellerInventoryView />;
}
