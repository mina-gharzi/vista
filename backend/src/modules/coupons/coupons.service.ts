import { isValidCouponCode, normalizeCouponCode, type CouponPreview } from "@vista/shared";
import { computeCharges, toPricedLines } from "../orders/orders.pricing";
import { evaluateCoupon } from "./coupons.engine";
import { couponInvalid } from "./coupons.errors";
import type { CouponsRepository } from "./coupons.repository";

export interface CouponsService {
  /** پیش‌نمایش روی «سبد فعلی سرور»؛ هیچ مصرفی ثبت نمی‌کند */
  preview(userId: string, rawCode: string): Promise<CouponPreview>;
}

export interface CouponsServiceOptions {
  now?: () => Date;
}

export function createCouponsService(
  repository: CouponsRepository,
  options: CouponsServiceOptions = {},
): CouponsService {
  const now = options.now ?? (() => new Date());

  return {
    async preview(userId, rawCode) {
      const code = normalizeCouponCode(rawCode);
      // فرمت نامعتبر هم «کد معتبر نیست» است (به Client نمی‌گوییم کد چه قالبی دارد)
      if (!isValidCouponCode(code)) throw couponInvalid();
      const coupon = await repository.findByCode(code);
      if (!coupon) throw couponInvalid();

      const [cartLines, parents] = await Promise.all([
        repository.loadCartLines(userId),
        repository.loadCategoryParents(),
      ]);
      // فقط کالاهای «قابل خرید» محاسبه می‌شوند؛ کالای ناموجود/تعلیق‌شده تخفیف نمی‌گیرد
      const purchasable = cartLines.filter(
        (line) =>
          line.productStatus === "PUBLISHED" && line.variantActive && line.sellerStatus === "APPROVED",
      );
      const userRedemptions =
        coupon.perUserLimit === null ? 0 : await repository.countActiveRedemptions(coupon.id, userId);

      const evaluation = evaluateCoupon({
        coupon,
        lines: toPricedLines(purchasable, parents),
        userRedemptions,
        now: now(),
      });
      const charges = computeCharges(evaluation.subtotal, evaluation.discountAmount);

      return {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        eligibleSubtotal: evaluation.eligibleSubtotal,
        subtotal: evaluation.subtotal,
        discountAmount: charges.discountAmount,
        shippingCost: charges.shippingCost,
        totalAmount: charges.totalAmount,
        appliesToAllItems: evaluation.appliesToAllItems,
      };
    },
  };
}
