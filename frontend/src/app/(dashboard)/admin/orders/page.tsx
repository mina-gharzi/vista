import type { Metadata } from "next";
import { AdminOrdersView } from "@/features/admin/AdminOrdersView";

export const metadata: Metadata = { title: "سفارش‌ها (مدیریت)" };

export default function Page() {
  return <AdminOrdersView />;
}
