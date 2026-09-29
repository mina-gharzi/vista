"use client";

import Link from "next/link";
import { Dropdown } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";

export function HeaderAuthArea() {
  const { status, user, logout } = useAuth();

  if (status === "loading") {
    // فضای ثابت تا با آماده‌شدن نشست، Header جابه‌جا نشود (کاهش Layout Shift)
    return <div className="h-11 w-20" aria-hidden="true" />;
  }

  if (status === "unauthenticated") {
    return (
      <Link href="/login" className="type-button rounded px-3 py-2 hover:bg-ivory-soft">
        ورود / ثبت‌نام
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/wishlist" className="type-button rounded px-3 py-2 hover:bg-ivory-soft">
        علاقه‌مندی‌ها
      </Link>
      <Link href="/cart" className="type-button rounded px-3 py-2 hover:bg-ivory-soft">
        سبد خرید
      </Link>
      <Dropdown
        label={user?.fullName.split(" ")[0] ?? "حساب کاربری"}
        align="end"
        items={[
          { key: "account", label: "حساب کاربری", href: "/account" },
          { key: "orders", label: "سفارش‌های من", href: "/orders" },
          { key: "logout", label: "خروج", tone: "danger", onSelect: () => void logout() },
        ]}
      />
    </div>
  );
}
