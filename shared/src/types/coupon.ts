import type { PaginatedResponse } from "./api";
import type { AdminAuditEntry } from "./admin";

/**
 * کوپن و تخفیف.
 *
 * قرارداد پولی پروژه: همهٔ مبالغ «عدد صحیح به تومان» هستند؛ هیچ محاسبهٔ اعشاری روی پول انجام نمی‌شود.
 *
 * قوانین (Server-side، منبع حقیقت: backend/src/modules/coupons/coupons.engine.ts):
 *  - هر سفارش حداکثر «یک» کوپن دارد (Stacking پشتیبانی نمی‌شود).
 *  - تخفیف فقط روی «کالاهای مشمول» حساب می‌شود: محدودیت فروشنده/محصول/دسته (دستهٔ والد، زیردسته‌ها را هم شامل می‌شود).
 *  - درصدی: floor(مجموع مشمول × درصد ÷ ۱۰۰) و سپس سقف «حداکثر تخفیف» (اگر تعریف شده)؛ ثابت: مبلغ تعریف‌شده.
 *    در هر دو حالت تخفیف هرگز از مجموع مشمول بیشتر نمی‌شود، پس جمع سفارش منفی نمی‌شود.
 *  - حداقل خرید روی «مجموع کالاهای مشمول» سنجیده می‌شود (نه کل سبد).
 *  - تخفیف بین ردیف‌های مشمول با روش «بیشترین باقی‌مانده» و با حسابداری عدد صحیح تقسیم می‌شود؛ جمع سهم‌ها
 *    دقیقاً برابر تخفیف سفارش است و سهم هر فروشنده = جمع سهم ردیف‌های او.
 *  - کوپن بالای قیمت فروش فعلی (basePrice/قیمت تنوع) اعمال می‌شود؛ «قیمت قبل از تخفیف» محصول در آن دخیل نیست.
 */

export type CouponDiscountType = "FIXED" | "PERCENTAGE";

export const COUPON_DISCOUNT_TYPE_LABEL: Record<CouponDiscountType, string> = {
  FIXED: "مبلغ ثابت",
  PERCENTAGE: "درصدی",
};

/** وضعیت «مشتق‌شده» برای نمایش؛ ذخیره نمی‌شود. اولویت: INACTIVE › EXPIRED › SCHEDULED › EXHAUSTED › ACTIVE */
export type CouponState = "ACTIVE" | "INACTIVE" | "SCHEDULED" | "EXPIRED" | "EXHAUSTED";

export const COUPON_STATE_LABEL: Record<CouponState, string> = {
  ACTIVE: "فعال",
  INACTIVE: "غیرفعال",
  SCHEDULED: "زمان‌بندی‌شده",
  EXPIRED: "منقضی‌شده",
  EXHAUSTED: "ظرفیت تمام‌شده",
};

export interface CouponStateInput {
  isActive: boolean;
  startsAt: Date | string | null;
  expiresAt: Date | string | null;
  usageLimit: number | null;
  usedCount: number;
}

export function deriveCouponState(coupon: CouponStateInput, now: Date): CouponState {
  if (!coupon.isActive) return "INACTIVE";
  const time = now.getTime();
  if (coupon.expiresAt !== null && new Date(coupon.expiresAt).getTime() <= time) return "EXPIRED";
  if (coupon.startsAt !== null && new Date(coupon.startsAt).getTime() > time) return "SCHEDULED";
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return "EXHAUSTED";
  return "ACTIVE";
}

/** کدهای خطای کوپن (error.code در پاسخ API) — Frontend فقط با همین‌ها تصمیم می‌گیرد. همگی HTTP 422 هستند. */
export const COUPON_ERROR_CODES = {
  /** کد وجود ندارد یا غیرفعال است (عمداً یکسان تا وضعیت داخلی کدها فاش نشود) */
  INVALID: "COUPON_INVALID",
  NOT_STARTED: "COUPON_NOT_STARTED",
  EXPIRED: "COUPON_EXPIRED",
  USAGE_LIMIT_REACHED: "COUPON_USAGE_LIMIT_REACHED",
  USER_LIMIT_REACHED: "COUPON_USER_LIMIT_REACHED",
  MIN_PURCHASE_NOT_MET: "COUPON_MIN_PURCHASE_NOT_MET",
  NOT_APPLICABLE: "COUPON_NOT_APPLICABLE",
  EMPTY_CART: "COUPON_EMPTY_CART",
} as const;

export type CouponErrorCode = (typeof COUPON_ERROR_CODES)[keyof typeof COUPON_ERROR_CODES];

export function isCouponErrorCode(code: string | undefined): code is CouponErrorCode {
  return code !== undefined && (Object.values(COUPON_ERROR_CODES) as string[]).includes(code);
}

/**
 * نتیجهٔ «پیش‌نمایش» کوپن روی سبد فعلی. این نتیجه «مصرف» کوپن نیست: شمارندهٔ استفاده فقط هنگام ثبت
 * موفق سفارش بالا می‌رود. مبالغ همگی از Server هستند.
 */
export interface CouponPreview {
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  /** جمع کالاهای مشمول (مبنای محاسبه) */
  eligibleSubtotal: number;
  subtotal: number;
  discountAmount: number;
  shippingCost: number;
  totalAmount: number;
  /** false = کوپن فقط روی بخشی از سبد اعمال شده است */
  appliesToAllItems: boolean;
}

// ───────── پنل ادمین ─────────

export interface AdminCouponListItem {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount: number | null;
  minPurchaseAmount: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  state: CouponState;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  sellerId: string | null;
  sellerName: string | null;
  /** تعداد محصول/دستهٔ محدودکننده؛ ۰ یعنی بدون آن محدودیت */
  productCount: number;
  categoryCount: number;
  createdAt: string;
}

export interface AdminCouponStats {
  /** تعداد استفادهٔ «فعال» (ثبت سفارش بدون لغو). با لغو سفارش پرداخت‌نشده یکی کم می‌شود. */
  usedCount: number;
  /** تعداد استفاده‌هایی که با لغو سفارش آزاد شده‌اند */
  releasedCount: number;
  /** null = بدون سقف */
  remaining: number | null;
  /** جمع تخفیف سفارش‌هایی که هنوز لغو نشده‌اند (تومان) */
  totalDiscountAmount: number;
}

export interface AdminCouponDetail extends AdminCouponListItem {
  updatedAt: string;
  products: { id: string; title: string }[];
  categories: { id: string; name: string }[];
  stats: AdminCouponStats;
  history: AdminAuditEntry[];
}

export type AdminCouponList = PaginatedResponse<AdminCouponListItem>;
