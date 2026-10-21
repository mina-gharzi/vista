import type { CouponPreview } from "@vista/shared";
import { apiRequest } from "./client";

/**
 * پیش‌نمایش کوپن روی «سبد فعلی سرور». مصرف کوپن نیست؛ مصرف فقط هنگام ثبت موفق سفارش (Checkout) رخ می‌دهد.
 * هیچ مبلغی به سرور ارسال نمی‌شود، فقط کد.
 */
export const couponsApi = {
  validate: (code: string, signal?: AbortSignal) =>
    apiRequest<CouponPreview>("/coupons/validate", {
      method: "POST",
      auth: true,
      body: { code },
      ...(signal ? { signal } : {}),
    }),
};
