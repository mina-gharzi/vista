import type { AdminAuditAction, CouponDiscountType, CouponState } from "@vista/shared";
import type { BadgeVariant } from "@/components/ui";
import { formatNumber, formatPrice } from "@/lib/utils/format";

export const couponStateBadge: Record<CouponState, BadgeVariant> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  SCHEDULED: "warning",
  EXPIRED: "danger",
  EXHAUSTED: "danger",
};

export function describeDiscount(type: CouponDiscountType, value: number): string {
  return type === "PERCENTAGE" ? `${formatNumber(value)}٪` : formatPrice(value);
}

export const COUPON_AUDIT_LABEL: Partial<Record<AdminAuditAction, string>> = {
  COUPON_CREATED: "ایجاد کوپن",
  COUPON_UPDATED: "ویرایش کوپن",
  COUPON_STATUS_CHANGED: "تغییر وضعیت",
};
