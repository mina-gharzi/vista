"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Badge,
  buttonClasses,
  Button,
  Card,
  ErrorState,
  Skeleton,
  SkeletonText,
} from "@/components/ui";
import { SellerApplicationForm } from "./SellerApplicationForm";
import { SELLER_STATUS_CONTENT } from "./statusContent";
import { useSellerApplicationStatus } from "./useSellerApplicationStatus";

const APPLY_PATH = "/seller/apply";
const DASHBOARD_PATH = "/seller/dashboard";

export function SellerApplicationStatusView() {
  const router = useRouter();
  const { state, data, reload } = useSellerApplicationStatus();
  const [reapplying, setReapplying] = useState(false);

  const missing = state === "ready" && data !== null && data.application === null;

  useEffect(() => {
    if (missing) router.replace(APPLY_PATH);
  }, [missing, router]);

  if (state === "loading" || missing) {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        <Skeleton className="h-8 w-1/2" />
        <SkeletonText lines={4} />
      </div>
    );
  }

  if (state === "error" || !data || !data.application) {
    return <ErrorState onRetry={reload} />;
  }

  const { application, canApply } = data;
  const content = SELLER_STATUS_CONTENT[application.status];

  if (reapplying && application.status === "REJECTED" && canApply) {
    return (
      <Card padding="lg" className="flex flex-col gap-6">
        <h2 className="type-h3">ارسال مجدد درخواست فروشندگی</h2>
        <SellerApplicationForm
          initialValues={application}
          onSubmitted={() => {
            setReapplying(false);
            reload();
          }}
          onStale={() => {
            setReapplying(false);
            reload();
          }}
        />
        <Button variant="ghost" onClick={() => setReapplying(false)}>
          انصراف
        </Button>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="flex flex-col gap-6" aria-live="polite">
      <div className="flex flex-col gap-3">
        <h2 className="type-h3">{content.title}</h2>
        <p className="flex items-center gap-2">
          <span className="text-ink-muted">وضعیت:</span>
          <Badge variant={content.badge}>{content.statusLabel}</Badge>
        </p>
        <p className="text-ink-muted">{content.description}</p>
      </div>

      <dl className="grid gap-3 rounded border border-border bg-ivory p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="type-caption">نام فروشگاه</dt>
          <dd className="font-medium">{application.storeName}</dd>
        </div>
        <div>
          <dt className="type-caption">شناسه فروشگاه</dt>
          <dd dir="ltr" className="text-start font-medium">
            {application.storeSlug}
          </dd>
        </div>
        {application.description && (
          <div className="sm:col-span-2">
            <dt className="type-caption">توضیحات</dt>
            <dd className="whitespace-pre-line">{application.description}</dd>
          </div>
        )}
      </dl>

      {application.status === "APPROVED" && (
        <Link href={DASHBOARD_PATH} className={buttonClasses({ size: "lg", fullWidth: true })}>
          ورود به پنل فروشنده
        </Link>
      )}
      {application.status === "REJECTED" && canApply && (
        <Button size="lg" fullWidth onClick={() => setReapplying(true)}>
          ویرایش و ارسال مجدد درخواست
        </Button>
      )}
    </Card>
  );
}
