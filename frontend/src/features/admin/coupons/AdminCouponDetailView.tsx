"use client";

import { COUPON_STATE_LABEL, type UpdateCouponInput } from "@vista/shared";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Card, useToast } from "@/components/ui";
import { adminApi } from "@/lib/api/admin";
import { formatDateTime, formatNumber, formatPrice } from "@/lib/utils/format";
import { ConfirmDialog } from "../ConfirmDialog";
import { QueryBoundary } from "../AdminParts";
import { useAdminQuery } from "../useAdminQuery";
import { CouponForm } from "./CouponForm";
import { couponToForm, toUpdatePayload } from "./couponFormModel";
import { COUPON_AUDIT_LABEL, couponStateBadge } from "./couponLabels";

export function AdminCouponDetailView({ couponId }: { couponId: string }) {
  const { state, reload, setData } = useAdminQuery(() => adminApi.coupon(couponId), couponId);
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  // نسخهٔ فرم: بعد از ذخیره/تازه‌سازی فرم با داده جدید دوباره ساخته می‌شود
  const [formVersion, setFormVersion] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href="/admin/coupons" className="text-sm text-bordeaux underline">
          بازگشت به کوپن‌ها
        </Link>
      </header>
      <QueryBoundary state={state} reload={reload} label="کوپن" notFoundTitle="کوپن یافت نشد">
        {(coupon) => (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h1 className="type-h1" dir="ltr">
                  {coupon.code}
                </h1>
                <Badge variant={couponStateBadge[coupon.state]}>{COUPON_STATE_LABEL[coupon.state]}</Badge>
              </div>
              <Button type="button" variant={coupon.isActive ? "danger" : "primary"} onClick={() => setConfirming(true)}>
                {coupon.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
              </Button>
            </div>

            <Card as="section" aria-labelledby="coupon-stats" className="flex flex-col gap-3">
              <h2 id="coupon-stats" className="type-h3">
                آمار استفاده
              </h2>
              <dl className="grid gap-4 sm:grid-cols-4">
                <Stat label="استفادهٔ فعال" value={formatNumber(coupon.stats.usedCount)} />
                <Stat label="آزادشده (لغو)" value={formatNumber(coupon.stats.releasedCount)} />
                <Stat label="باقی‌مانده" value={coupon.stats.remaining === null ? "نامحدود" : formatNumber(coupon.stats.remaining)} />
                <Stat label="جمع تخفیف" value={formatPrice(coupon.stats.totalDiscountAmount)} />
              </dl>
            </Card>

            <CouponForm
              key={`${coupon.updatedAt}-${formVersion}`}
              mode="edit"
              initial={couponToForm(coupon)}
              toPayload={toUpdatePayload}
              submitLabel="ذخیرهٔ تغییرات"
              onSubmit={async (payload: UpdateCouponInput) => {
                const updated = await adminApi.updateCoupon(coupon.id, payload);
                setData(updated);
                toast({ title: "تغییرات ذخیره شد", variant: "success" });
              }}
            />

            <Card as="section" aria-labelledby="coupon-history" className="flex flex-col gap-3">
              <h2 id="coupon-history" className="type-h3">
                سابقهٔ تغییرات
              </h2>
              {coupon.history.length === 0 ? (
                <p className="text-sm text-ink-muted">تغییری ثبت نشده است.</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {coupon.history.map((h) => (
                    <li key={h.id} className="text-sm">
                      <span className="font-medium">{COUPON_AUDIT_LABEL[h.action] ?? h.action}</span>
                      <span className="text-ink-muted">
                        {" "}
                        · {h.adminName} · {formatDateTime(h.createdAt)}
                      </span>
                      {h.reason && <p className="text-ink-muted">{h.reason}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            {confirming && (
              <ConfirmDialog
                title={coupon.isActive ? "غیرفعال‌سازی کوپن" : "فعال‌سازی کوپن"}
                description={
                  coupon.isActive
                    ? "مشتریان دیگر نمی‌توانند از این کد استفاده کنند. سفارش‌های ثبت‌شده تغییری نمی‌کنند."
                    : "کد برای مشتریان قابل استفاده می‌شود."
                }
                confirmLabel={coupon.isActive ? "غیرفعال کن" : "فعال کن"}
                danger={coupon.isActive}
                successMessage={coupon.isActive ? "کوپن غیرفعال شد" : "کوپن فعال شد"}
                onConfirm={async () => {
                  const updated = await adminApi.setCouponStatus(coupon.id, { isActive: !coupon.isActive });
                  setData(updated);
                  setFormVersion((v) => v + 1);
                }}
                onClose={() => setConfirming(false)}
                onStale={reload}
              />
            )}
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-base font-medium">{value}</dd>
    </div>
  );
}
