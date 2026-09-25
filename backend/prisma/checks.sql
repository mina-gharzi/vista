-- VISTA — CHECK Constraintهایی که Prisma Schema بیان نمی‌کند.
-- این محتوا را «انتهای» فایل migration.sql مربوط به Migration اولیه/جدید کپی کن
-- (راهنما در توضیحات Phase 0). هدف: Database خودش آخرین خط دفاعی Integrity باشد،
-- حتی اگر باگی در Service وجود داشته باشد (Database as Source of Truth — بخش ۱۵ و ۲۶).

-- موجودی هرگز منفی نمی‌شود → Overselling در سطح Database غیرممکن است
ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_stock_non_negative" CHECK ("stock" >= 0);

-- قیمت‌ها
ALTER TABLE "products"
  ADD CONSTRAINT "products_base_price_positive" CHECK ("basePrice" > 0),
  ADD CONSTRAINT "products_compare_at_price_valid"
    CHECK ("compareAtPrice" IS NULL OR "compareAtPrice" > "basePrice");

ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_price_positive" CHECK ("price" IS NULL OR "price" > 0);

-- تعداد در سبد و سفارش
ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_items_unit_price_positive" CHECK ("unitPrice" >= 0);

-- مبالغ سفارش
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_amounts_valid" CHECK (
    "subtotal" >= 0 AND "shippingCost" >= 0 AND "discountAmount" >= 0
    AND "totalAmount" >= 0
    AND "totalAmount" = "subtotal" + "shippingCost" - "discountAmount"
  );

-- امتیاز ریویو
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
