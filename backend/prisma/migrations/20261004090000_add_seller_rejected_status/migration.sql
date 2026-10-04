-- AlterEnum
-- وضعیت REJECTED برای چرخه عمر درخواست فروشندگی (PENDING → APPROVED | REJECTED، و SUSPENDED).
-- ADD VALUE برای رکوردهای موجود امن است و داده‌ای را تغییر نمی‌دهد.
ALTER TYPE "SellerStatus" ADD VALUE 'REJECTED';
