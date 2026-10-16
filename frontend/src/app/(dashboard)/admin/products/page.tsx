import type { Metadata } from "next";
import { AdminProductsView } from "@/features/admin/AdminProductsView";

export const metadata: Metadata = { title: "محصولات (مدیریت)" };
const UUID = /^[0-9a-f-]{36}$/i;

export default function Page({ searchParams }: { searchParams: { sellerId?: string } }) {
  return <AdminProductsView initialSellerId={UUID.test(searchParams.sellerId ?? "") ? (searchParams.sellerId as string) : ""} />;
}
