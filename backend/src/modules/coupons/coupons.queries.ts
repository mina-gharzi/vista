import type { Prisma } from "@prisma/client";
import type { CouponRules } from "./coupons.engine";

/** PrismaClient یا Client داخل Transaction */
export type Db = Prisma.TransactionClient;

export const COUPON_RULES_SELECT = {
  id: true,
  code: true,
  description: true,
  discountType: true,
  discountValue: true,
  maxDiscountAmount: true,
  minPurchaseAmount: true,
  startsAt: true,
  expiresAt: true,
  isActive: true,
  usageLimit: true,
  perUserLimit: true,
  usedCount: true,
  sellerId: true,
  productIds: true,
  categoryIds: true,
} satisfies Prisma.CouponSelect;

type CouponRulesRow = Prisma.CouponGetPayload<{ select: typeof COUPON_RULES_SELECT }>;

export function toCouponRules(row: CouponRulesRow): CouponRules {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    discountType: row.discountType,
    discountValue: row.discountValue,
    maxDiscountAmount: row.maxDiscountAmount,
    minPurchaseAmount: row.minPurchaseAmount,
    startsAt: row.startsAt,
    expiresAt: row.expiresAt,
    isActive: row.isActive,
    usageLimit: row.usageLimit,
    perUserLimit: row.perUserLimit,
    usedCount: row.usedCount,
    sellerId: row.sellerId,
    productIds: row.productIds,
    categoryIds: row.categoryIds,
  };
}

/** `code` باید قبلاً نرمال شده باشد (normalizeCouponCode) */
export async function findCouponRulesByCode(db: Db, code: string): Promise<CouponRules | null> {
  const row = await db.coupon.findUnique({ where: { code }, select: COUPON_RULES_SELECT });
  return row ? toCouponRules(row) : null;
}

/** فقط استفاده‌های «فعال» (سفارش لغوشده سقف مشتری را مصرف نمی‌کند) */
export function countActiveRedemptions(db: Db, couponId: string, userId: string): Promise<number> {
  return db.couponRedemption.count({ where: { couponId, userId, status: "ACTIVE" } });
}

/** جدول دسته‌ها کوچک است؛ یک Query برای ساخت زنجیرهٔ والدها (بدون N+1) */
export async function loadCategoryParents(db: Db): Promise<Map<string, string | null>> {
  const rows = await db.category.findMany({ select: { id: true, parentId: true } });
  return new Map(rows.map((row) => [row.id, row.parentId]));
}
