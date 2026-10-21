import type { PrismaClient } from "@prisma/client";
import { queryCartLines, type CartLine } from "../orders/orders.repository";
import type { CouponRules } from "./coupons.engine";
import { countActiveRedemptions, findCouponRulesByCode, loadCategoryParents } from "./coupons.queries";

/** خواندنی‌های پیش‌نمایش کوپن (هیچ نوشتنی ندارد: پیش‌نمایش «مصرف» نیست) */
export interface CouponsRepository {
  /** `code` نرمال‌شده */
  findByCode(code: string): Promise<CouponRules | null>;
  countActiveRedemptions(couponId: string, userId: string): Promise<number>;
  loadCartLines(userId: string): Promise<CartLine[]>;
  loadCategoryParents(): Promise<Map<string, string | null>>;
}

export function createCouponsRepository(prisma: PrismaClient): CouponsRepository {
  return {
    findByCode: (code) => findCouponRulesByCode(prisma, code),
    countActiveRedemptions: (couponId, userId) => countActiveRedemptions(prisma, couponId, userId),
    loadCartLines: (userId) => queryCartLines(prisma, userId),
    loadCategoryParents: () => loadCategoryParents(prisma),
  };
}
