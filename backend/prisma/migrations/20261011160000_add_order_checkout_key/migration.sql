-- AlterTable
ALTER TABLE "orders" ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "checkoutKey" TEXT;

-- CreateIndex
CREATE INDEX "orders_userId_status_createdAt_idx" ON "orders"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "orders_userId_checkoutKey_key" ON "orders"("userId", "checkoutKey");
