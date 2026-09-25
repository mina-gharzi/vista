"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";

const roleLabels = { CUSTOMER: "مشتری", SELLER: "فروشنده", ADMIN: "مدیر" } as const;

export function AccountView() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.replace("/login");
  };

  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="type-h2">{user.fullName}</h1>
        <Badge variant="brand">{roleLabels[user.role]}</Badge>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-ink-muted">ایمیل</dt>
        <dd dir="ltr" className="text-start">
          {user.email}
        </dd>
        <dt className="text-ink-muted">موبایل</dt>
        <dd dir="ltr" className="text-start">
          {user.phone ?? "—"}
        </dd>
      </dl>
      <div>
        <Button variant="secondary" onClick={handleLogout} loading={loggingOut}>
          خروج از حساب
        </Button>
      </div>
    </Card>
  );
}
