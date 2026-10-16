import type { Metadata } from "next";
import type { SellerStatus } from "@vista/shared";
import { AdminSellersView } from "@/features/admin/AdminSellersView";

export const metadata: Metadata = { title: "فروشندگان (مدیریت)" };
const VALID = ["PENDING", "APPROVED", "SUSPENDED", "REJECTED"];

export default function Page({ searchParams }: { searchParams: { status?: string } }) {
  const status = VALID.includes(searchParams.status ?? "") ? (searchParams.status as SellerStatus) : "";
  return <AdminSellersView initialStatus={status} />;
}
