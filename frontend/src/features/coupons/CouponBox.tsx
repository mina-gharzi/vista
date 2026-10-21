"use client";

import { type FormEvent } from "react";
import { Badge, Button, Input } from "@/components/ui";
import { formatPrice } from "@/lib/utils/format";
import type { CouponController } from "./useCoupon";

/**
 * ورودی کد تخفیف + وضعیت اعمال‌شده. همهٔ مبالغ از پاسخ سرور می‌آیند.
 * خطا زیر فیلد (role=alert)، اعلان حذف خودکار کوپن با role=status.
 */
export function CouponBox({ coupon }: { coupon: CouponController }) {
  const { applied, applying, input, error, notice } = coupon;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void coupon.apply();
  };

  return (
    <section aria-label="کد تخفیف" className="flex flex-col gap-3">
      {applied ? (
        <div className="flex flex-col gap-2 rounded border border-border bg-ivory p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm">
              <Badge variant="premium">کد تخفیف</Badge>
              <span dir="ltr" className="font-medium tracking-wide">
                {applied.code}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={coupon.remove}
              disabled={coupon.busy}
              aria-label={`حذف کد تخفیف ${applied.code}`}
            >
              حذف
            </Button>
          </div>
          {applied.description && <p className="type-caption">{applied.description}</p>}
          {!applied.appliesToAllItems && (
            <p className="type-caption">
              این کد فقط روی بخشی از کالاهای سبد اعمال شده است (مبلغ مشمول: {formatPrice(applied.eligibleSubtotal)}).
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex items-start gap-2">
          <div className="flex-1">
            <Input
              label="کد تخفیف"
              name="couponCode"
              dir="ltr"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={input}
              onChange={(event) => coupon.setInput(event.target.value)}
              error={error ?? ""}
              disabled={applying}
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            className="mt-7"
            loading={applying}
            disabled={applying || input.trim() === ""}
          >
            اعمال
          </Button>
        </form>
      )}

      {notice && (
        <p role="status" className="rounded border border-warning bg-warning-tint p-3 text-sm">
          {notice}
        </p>
      )}
    </section>
  );
}
