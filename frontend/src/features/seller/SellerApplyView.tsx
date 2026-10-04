"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, EmptyState, ErrorState, Skeleton, SkeletonText } from "@/components/ui";
import { SellerApplicationForm } from "./SellerApplicationForm";
import { useSellerApplicationStatus } from "./useSellerApplicationStatus";

export const SELLER_APPLICATION_PATH = "/seller/application";
export const SELLER_DASHBOARD_PATH = "/seller/dashboard";

/**
 * صفحه /seller/apply. این هدایت‌ها فقط UX هستند؛ Backend همین قوانین را مستقل اعمال می‌کند.
 *  - بدون درخواست → فرم
 *  - APPROVED → داشبورد فروشنده
 *  - PENDING / REJECTED / SUSPENDED → صفحه وضعیت
 */
export function SellerApplyView() {
  const router = useRouter();
  const { state, data, reload } = useSellerApplicationStatus();

  const application = data?.application ?? null;
  const redirectTo =
    application === null
      ? null
      : application.status === "APPROVED"
        ? SELLER_DASHBOARD_PATH
        : SELLER_APPLICATION_PATH;

  useEffect(() => {
    if (state === "ready" && redirectTo) router.replace(redirectTo);
  }, [state, redirectTo, router]);

  if (state === "loading" || (state === "ready" && redirectTo)) {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        <Skeleton className="h-8 w-1/2" />
        <SkeletonText lines={4} />
      </div>
    );
  }

  if (state === "error" || !data) {
    return <ErrorState onRetry={reload} />;
  }

  if (!data.canApply) {
    return (
      <EmptyState
        title="امکان ثبت درخواست فروشندگی برای این حساب وجود ندارد"
        description="اگر فکر می‌کنید این یک اشتباه است با پشتیبانی ویستا تماس بگیرید."
      />
    );
  }

  return (
    <Card padding="lg" className="flex flex-col gap-6">
      <SellerApplicationForm
        onSubmitted={() => router.replace(SELLER_APPLICATION_PATH)}
        onStale={reload}
      />
    </Card>
  );
}
