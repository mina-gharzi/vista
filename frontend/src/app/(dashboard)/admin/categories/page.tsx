import type { Metadata } from "next";
import { AdminCategoriesView } from "@/features/admin/AdminCategoriesView";

export const metadata: Metadata = { title: "دسته‌بندی‌ها" };

export default function Page() {
  return <AdminCategoriesView />;
}
