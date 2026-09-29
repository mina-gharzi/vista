"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, Tabs } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { AddressesManager } from "./AddressesManager";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { PersonalInfoForm } from "./PersonalInfoForm";

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
    <div className="flex flex-col gap-6">
      <Card padding="lg" className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="type-h2">{user.fullName}</h1>
          <Badge variant="brand">{roleLabels[user.role]}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/orders">
            <Button variant="secondary">سفارش‌های من</Button>
          </Link>
          <Button variant="ghost" onClick={handleLogout} loading={loggingOut}>
            خروج از حساب
          </Button>
        </div>
      </Card>

      <Card padding="lg">
        <Tabs
          label="بخش‌های حساب کاربری"
          tabs={[
            { value: "info", label: "اطلاعات شخصی", content: <PersonalInfoForm /> },
            { value: "addresses", label: "آدرس‌ها", content: <AddressesManager /> },
            { value: "password", label: "رمز عبور", content: <ChangePasswordForm /> },
          ]}
        />
      </Card>
    </div>
  );
}
