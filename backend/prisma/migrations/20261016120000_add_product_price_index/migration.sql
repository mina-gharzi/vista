-- CreateIndex: مرتب‌سازی قیمت در کاتالوگ (فقط محصولات منتشرشده)
CREATE INDEX "products_status_basePrice_idx" ON "products"("status", "basePrice");
