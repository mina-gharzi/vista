"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses, EmptyState } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";

/**
 * فقط UX: کاربر غیرادمین به‌جای صفحهٔ شکسته، پیام «دسترسی ندارید» می‌بیند و هیچ درخواست ادمینی نمی‌فرستد.
 * مرجع واقعی دسترسی Backend است (نقش از دیتابیس)؛ دور زدن این بررسی هیچ داده‌ای باز نمی‌کند.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "ADMIN") {
    return (
      <EmptyState
        title="دسترسی به پنل مدیریت ندارید"
        description="این بخش فقط برای مدیران سیستم در دسترس است."
        action={
          <Link href="/" className={buttonClasses({ variant: "primary" })}>
            بازگشت به فروشگاه
          </Link>
        }
      />
    );
  }
  return <>{children}</>;
}
