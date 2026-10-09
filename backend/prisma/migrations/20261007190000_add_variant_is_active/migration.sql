-- AlterTable
-- آرشیو تنوع به‌جای حذف فیزیکی: OrderItem به Variant ارجاع دارد (Restrict) و InventoryMovement با حذف Variant پاک می‌شد.
-- ستون با DEFAULT true اضافه می‌شود؛ همه رکوردهای موجود فعال می‌مانند و داده‌ای تغییر نمی‌کند.
ALTER TABLE "product_variants" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
