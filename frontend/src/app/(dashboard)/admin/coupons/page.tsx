import type { Metadata } from "next";
import { AdminCouponsView } from "@/features/admin/coupons/AdminCouponsView";

export const metadata: Metadata = { title: "کوپن‌ها (مدیریت)" };

export default function Page() {
  return <AdminCouponsView />;
}
