import type { Metadata } from "next";
import { AdminCouponCreateView } from "@/features/admin/coupons/AdminCouponCreateView";

export const metadata: Metadata = { title: "کوپن جدید" };

export default function Page() {
  return <AdminCouponCreateView />;
}
