-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "CouponRedemptionStatus" AS ENUM ('ACTIVE', 'RELEASED');

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "CouponDiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "maxDiscountAmount" INTEGER,
    "minPurchaseAmount" INTEGER,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageLimit" INTEGER,
    "perUserLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "sellerId" TEXT,
    "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "discountAmount" INTEGER NOT NULL,
    "status" "CouponRedemptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "couponId" TEXT,
ADD COLUMN "couponCode" TEXT;

-- AlterTable
ALTER TABLE "seller_orders" ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_orderId_key" ON "coupon_redemptions"("orderId");

-- CreateIndex
CREATE INDEX "coupon_redemptions_couponId_userId_status_idx" ON "coupon_redemptions"("couponId", "userId", "status");

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- CHECK Constraint ها: دیتابیس آخرین خط دفاع Integrity است، حتی اگر Service باگ داشته باشد.
-- ─────────────────────────────────────────────────────────────────────────

-- کد: نرمال‌شده (حروف بزرگ لاتین/رقم/خط‌تیره/زیرخط) → یکتایی بدون حساسیت به حروف تضمین می‌شود
ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_code_format" CHECK ("code" ~ '^[A-Z0-9_-]{3,32}$'),
  ADD CONSTRAINT "coupons_discount_value_positive" CHECK ("discountValue" >= 1),
  ADD CONSTRAINT "coupons_percentage_range" CHECK ("discountType" <> 'PERCENTAGE' OR "discountValue" <= 100),
  ADD CONSTRAINT "coupons_max_discount_valid" CHECK (
    "maxDiscountAmount" IS NULL OR ("maxDiscountAmount" >= 1 AND "discountType" = 'PERCENTAGE')
  ),
  ADD CONSTRAINT "coupons_min_purchase_valid" CHECK ("minPurchaseAmount" IS NULL OR "minPurchaseAmount" >= 1),
  ADD CONSTRAINT "coupons_dates_valid" CHECK (
    "startsAt" IS NULL OR "expiresAt" IS NULL OR "expiresAt" > "startsAt"
  ),
  ADD CONSTRAINT "coupons_usage_limits_valid" CHECK (
    ("usageLimit" IS NULL OR "usageLimit" >= 1)
    AND ("perUserLimit" IS NULL OR "perUserLimit" >= 1)
    AND ("usageLimit" IS NULL OR "perUserLimit" IS NULL OR "perUserLimit" <= "usageLimit")
  ),
  -- شمارنده هرگز منفی نمی‌شود و از سقف کل رد نمی‌شود (حتی با درخواست‌های همزمان)
  ADD CONSTRAINT "coupons_used_count_valid" CHECK (
    "usedCount" >= 0 AND ("usageLimit" IS NULL OR "usedCount" <= "usageLimit")
  );

ALTER TABLE "coupon_redemptions"
  ADD CONSTRAINT "coupon_redemptions_discount_non_negative" CHECK ("discountAmount" >= 0);

-- سهم تخفیف هیچ فروشنده/ردیفی از مبلغ خودش بیشتر یا منفی نمی‌شود
ALTER TABLE "seller_orders"
  ADD CONSTRAINT "seller_orders_discount_valid" CHECK ("discountAmount" >= 0 AND "discountAmount" <= "subtotal");

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_discount_valid" CHECK (
    "discountAmount" >= 0
    AND "discountAmount"::bigint <= "unitPrice"::bigint * "quantity"::bigint
  );

-- هر تخفیفی روی سفارش باید به یک کوپن ارجاع داشته باشد (منبع دیگری برای تخفیف وجود ندارد)
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_discount_requires_coupon" CHECK ("discountAmount" = 0 OR "couponId" IS NOT NULL);
