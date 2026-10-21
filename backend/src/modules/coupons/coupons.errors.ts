import { COUPON_ERROR_CODES, type CouponErrorCode } from "@vista/shared";
import { AppError } from "../../errors/AppError";

const faNumber = (value: number): string => new Intl.NumberFormat("fa-IR").format(value);

const MESSAGES: Record<CouponErrorCode, string> = {
  COUPON_INVALID: "کد تخفیف معتبر نیست",
  COUPON_NOT_STARTED: "این کد تخفیف هنوز فعال نشده است",
  COUPON_EXPIRED: "مهلت استفاده از این کد تخفیف به پایان رسیده است",
  COUPON_USAGE_LIMIT_REACHED: "ظرفیت استفاده از این کد تخفیف تمام شده است",
  COUPON_USER_LIMIT_REACHED: "شما حداکثر دفعات مجاز استفاده از این کد تخفیف را مصرف کرده‌اید",
  COUPON_MIN_PURCHASE_NOT_MET: "مبلغ کالاهای مشمول به حداقل خرید این کد تخفیف نرسیده است",
  COUPON_NOT_APPLICABLE: "این کد تخفیف برای هیچ‌کدام از کالاهای سبد شما قابل استفاده نیست",
  COUPON_EMPTY_CART: "سبد خرید شما خالی است",
};

/**
 * همهٔ خطاهای «قانون کوپن» HTTP 422 با کد COUPON_* هستند. Frontend بر اساس code تصمیم می‌گیرد؛
 * 404 عمداً استفاده نشده چون در Checkout یعنی «آدرس یافت نشد».
 */
export class CouponRuleError extends AppError {
  constructor(
    public readonly couponCode: CouponErrorCode,
    details?: Record<string, string[]>,
    message?: string,
  ) {
    super(message ?? MESSAGES[couponCode], 422, couponCode, details);
  }
}

export const couponInvalid = (): CouponRuleError => new CouponRuleError(COUPON_ERROR_CODES.INVALID);

export const couponMinPurchaseNotMet = (min: number, eligibleSubtotal: number): CouponRuleError =>
  new CouponRuleError(
    COUPON_ERROR_CODES.MIN_PURCHASE_NOT_MET,
    { minPurchaseAmount: [String(min)], eligibleSubtotal: [String(eligibleSubtotal)] },
    `حداقل خرید برای این کد تخفیف ${faNumber(min)} تومان از کالاهای مشمول است (مجموع فعلی: ${faNumber(eligibleSubtotal)} تومان)`,
  );
