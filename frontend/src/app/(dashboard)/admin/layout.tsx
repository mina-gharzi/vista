import type { ReactNode } from "react";
import { AdminShell } from "@/features/admin/AdminShell";
import { RequireAdmin } from "@/features/admin/RequireAdmin";
import { RequireAuth } from "@/features/auth/guards";

/**
 * ناحیه مدیریت: ورود الزامی + بررسی نقش (فقط UX). مرجع واقعی دسترسی، Backend است
 * (نقش ADMIN از دیتابیس در هر درخواست /api/admin/*).
 */
export default function AdminAreaLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AdminShell>
        <RequireAdmin>{children}</RequireAdmin>
      </AdminShell>
    </RequireAuth>
  );
}
