import type { Metadata } from "next";
import { AdminCouponDetailView } from "@/features/admin/coupons/AdminCouponDetailView";

export const metadata: Metadata = { title: "جزئیات کوپن" };

export default function Page({ params }: { params: { couponId: string } }) {
  return <AdminCouponDetailView couponId={params.couponId} />;
}
