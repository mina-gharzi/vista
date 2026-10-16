import type { Metadata } from "next";
import { AdminDashboardView } from "@/features/admin/AdminDashboardView";

export const metadata: Metadata = { title: "داشبورد مدیریت" };

export default function Page() {
  return <AdminDashboardView />;
}
