import { isCouponErrorCode, type CouponErrorCode } from "@vista/shared";
import { ApiRequestError } from "@/lib/api/client";

export interface DescribedCouponError {
  message: string;
  /** rule = قانون کوپن (کد/سبد قابل‌اصلاح)؛ auth = ورود دوباره لازم؛ transient = شبکه/محدودیت (تلاش مجدد ممکن) */
  kind: "rule" | "auth" | "transient" | "other";
  code?: CouponErrorCode;
}

const GENERIC = "بررسی کد تخفیف انجام نشد. لطفاً دوباره تلاش کنید.";

/** پیام فارسی امن برای هر خطای کوپن؛ پیام خام 5xx هرگز نشان داده نمی‌شود. */
export function describeCouponError(error: unknown): DescribedCouponError {
  if (!(error instanceof ApiRequestError)) return { kind: "other", message: GENERIC };
  if (error.code === "NETWORK_ERROR") return { kind: "transient", message: error.message };
  if (error.status === 401) {
    return { kind: "auth", message: "نشست شما منقضی شده است. لطفاً دوباره وارد شوید." };
  }
  if (isCouponErrorCode(error.code)) return { kind: "rule", code: error.code, message: error.message };
  if (error.status === 429) return { kind: "transient", message: error.message };
  if (error.status === 400) return { kind: "rule", message: error.message };
  return { kind: "other", message: GENERIC };
}
