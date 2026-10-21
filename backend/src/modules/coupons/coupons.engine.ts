import { COUPON_ERROR_CODES, type CouponDiscountType } from "@vista/shared";
import { CouponRuleError, couponInvalid, couponMinPurchaseNotMet } from "./coupons.errors";

/**
 * موتور خالص (بدون دیتابیس و بدون Date.now) محاسبهٔ کوپن؛ تنها منبع قوانین تخفیف.
 * همهٔ مبالغ عدد صحیح تومان‌اند. هر جا ضرب دو مبلغ ممکن است از ۲^۵۳ بگذرد از BigInt استفاده می‌شود؛
 * هیچ Float یا گردکردن اعشاری روی پول وجود ندارد.
 */

export interface CouponRules {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount: number | null;
  minPurchaseAmount: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  sellerId: string | null;
  productIds: readonly string[];
  categoryIds: readonly string[];
}

/** یک ردیف سبد با داده‌های «قابل اعتماد» دیتابیس */
export interface PricedLine {
  variantId: string;
  productId: string;
  sellerId: string;
  /** دستهٔ محصول + همهٔ والدهای آن (محدودیت دستهٔ والد، زیردسته‌ها را هم شامل می‌شود) */
  categoryChain: readonly string[];
  unitPrice: number;
  quantity: number;
}

export interface CouponEvaluation {
  subtotal: number;
  /** جمع کالاهای مشمول (مبنای حداقل خرید و درصد) */
  eligibleSubtotal: number;
  discountAmount: number;
  /** سهم هر ردیف (variantId → تومان)؛ فقط ردیف‌های مشمول */
  lineDiscounts: ReadonlyMap<string, number>;
  /** سهم هر فروشنده (sellerId → تومان) = جمع سهم ردیف‌های او */
  sellerDiscounts: ReadonlyMap<string, number>;
  appliesToAllItems: boolean;
}

export const lineTotal = (line: Pick<PricedLine, "unitPrice" | "quantity">): number =>
  line.unitPrice * line.quantity;

/** زنجیرهٔ «خودِ دسته + والدها»؛ با محافظ حلقه/عمق برای داده‌های خراب */
export function categoryChainOf(
  categoryId: string,
  parents: ReadonlyMap<string, string | null>,
): string[] {
  const chain: string[] = [];
  let current: string | null | undefined = categoryId;
  while (current && !chain.includes(current) && chain.length < 12) {
    chain.push(current);
    current = parents.get(current);
  }
  return chain;
}

/**
 * مشمولیت یک ردیف: فروشنده (اگر تعریف شده) «و» (محصول‌ها «یا» دسته‌ها اگر هر کدام تعریف شده).
 * یعنی محصول‌ها و دسته‌ها «اجتماع» هم‌اند؛ فروشنده همیشه محدودکنندهٔ اضافه است.
 */
export function isLineEligible(coupon: CouponRules, line: PricedLine): boolean {
  if (coupon.sellerId !== null && line.sellerId !== coupon.sellerId) return false;
  const hasProducts = coupon.productIds.length > 0;
  const hasCategories = coupon.categoryIds.length > 0;
  if (!hasProducts && !hasCategories) return true;
  const productMatch = hasProducts && coupon.productIds.includes(line.productId);
  const categoryMatch =
    hasCategories && line.categoryChain.some((id) => coupon.categoryIds.includes(id));
  return productMatch || categoryMatch;
}

/** مبلغ تخفیف قبل از تقسیم بین ردیف‌ها؛ هرگز از eligible بیشتر نیست */
export function computeDiscountAmount(coupon: CouponRules, eligibleSubtotal: number): number {
  let discount: number;
  if (coupon.discountType === "PERCENTAGE") {
    discount = Number((BigInt(eligibleSubtotal) * BigInt(coupon.discountValue)) / 100n);
    if (coupon.maxDiscountAmount !== null) discount = Math.min(discount, coupon.maxDiscountAmount);
  } else {
    discount = coupon.discountValue;
  }
  return Math.max(0, Math.min(discount, eligibleSubtotal));
}

/**
 * تقسیم عدد صحیح `total` متناسب با وزن‌ها به روش «بیشترین باقی‌مانده»:
 * جمع سهم‌ها دقیقاً برابر total، هر سهم ≤ وزن خودش، و نتیجه Deterministic (تساوی با کلید صعودی).
 */
export function allocateProportionally(
  total: number,
  weights: readonly { key: string; weight: number }[],
): Map<string, number> {
  const result = new Map<string, number>();
  const sumWeights = weights.reduce((sum, w) => sum + BigInt(w.weight), 0n);
  if (sumWeights === 0n || total <= 0) {
    for (const w of weights) result.set(w.key, 0);
    return result;
  }
  const totalBig = BigInt(total);
  const parts = weights.map((w) => {
    const numerator = totalBig * BigInt(w.weight);
    return { key: w.key, base: numerator / sumWeights, remainder: numerator % sumWeights };
  });
  let leftover = totalBig - parts.reduce((sum, p) => sum + p.base, 0n);
  const order = [...parts].sort((a, b) =>
    a.remainder === b.remainder
      ? a.key.localeCompare(b.key)
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  const bonus = new Set<string>();
  for (const part of order) {
    if (leftover <= 0n) break;
    bonus.add(part.key);
    leftover -= 1n;
  }
  for (const part of parts) {
    result.set(part.key, Number(part.base) + (bonus.has(part.key) ? 1 : 0));
  }
  return result;
}

export interface EvaluateInput {
  coupon: CouponRules;
  lines: readonly PricedLine[];
  /** تعداد استفادهٔ «فعال» همین مشتری از همین کوپن */
  userRedemptions: number;
  now: Date;
}

/**
 * اعتبارسنجی + محاسبه. ترتیب بررسی‌ها ثابت است تا پیام خطا قابل‌پیش‌بینی باشد.
 * هیچ تغییری روی دیتابیس نمی‌دهد (پیش‌نمایش «مصرف» نیست).
 */
export function evaluateCoupon({ coupon, lines, userRedemptions, now }: EvaluateInput): CouponEvaluation {
  if (!coupon.isActive) throw couponInvalid();
  if (coupon.expiresAt !== null && coupon.expiresAt.getTime() <= now.getTime()) {
    throw new CouponRuleError(COUPON_ERROR_CODES.EXPIRED);
  }
  if (coupon.startsAt !== null && coupon.startsAt.getTime() > now.getTime()) {
    throw new CouponRuleError(COUPON_ERROR_CODES.NOT_STARTED);
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new CouponRuleError(COUPON_ERROR_CODES.USAGE_LIMIT_REACHED);
  }
  if (coupon.perUserLimit !== null && userRedemptions >= coupon.perUserLimit) {
    throw new CouponRuleError(COUPON_ERROR_CODES.USER_LIMIT_REACHED);
  }
  if (lines.length === 0) throw new CouponRuleError(COUPON_ERROR_CODES.EMPTY_CART);

  const subtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const eligible = lines.filter((line) => isLineEligible(coupon, line));
  const eligibleSubtotal = eligible.reduce((sum, line) => sum + lineTotal(line), 0);
  if (eligible.length === 0 || eligibleSubtotal <= 0) {
    throw new CouponRuleError(COUPON_ERROR_CODES.NOT_APPLICABLE);
  }
  if (coupon.minPurchaseAmount !== null && eligibleSubtotal < coupon.minPurchaseAmount) {
    throw couponMinPurchaseNotMet(coupon.minPurchaseAmount, eligibleSubtotal);
  }

  const discountAmount = computeDiscountAmount(coupon, eligibleSubtotal);
  // تخفیف صفر (مثلاً ۵٪ از مبلغ بسیار کوچک) = کوپن بی‌اثر؛ استفاده‌ای مصرف نمی‌شود
  if (discountAmount <= 0) throw new CouponRuleError(COUPON_ERROR_CODES.NOT_APPLICABLE);

  const lineDiscounts = allocateProportionally(
    discountAmount,
    eligible.map((line) => ({ key: line.variantId, weight: lineTotal(line) })),
  );
  const sellerDiscounts = new Map<string, number>();
  for (const line of eligible) {
    const share = lineDiscounts.get(line.variantId) ?? 0;
    sellerDiscounts.set(line.sellerId, (sellerDiscounts.get(line.sellerId) ?? 0) + share);
  }

  return {
    subtotal,
    eligibleSubtotal,
    discountAmount,
    lineDiscounts,
    sellerDiscounts,
    appliesToAllItems: eligible.length === lines.length,
  };
}
