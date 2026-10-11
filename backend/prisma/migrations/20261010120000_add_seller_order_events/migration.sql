-- CreateTable
CREATE TABLE "seller_order_events" (
    "id" TEXT NOT NULL,
    "sellerOrderId" TEXT NOT NULL,
    "fromStatus" "FulfillmentStatus" NOT NULL,
    "toStatus" "FulfillmentStatus" NOT NULL,
    "trackingCode" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_order_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seller_order_events_sellerOrderId_createdAt_idx" ON "seller_order_events"("sellerOrderId", "createdAt");

-- AddForeignKey
ALTER TABLE "seller_order_events" ADD CONSTRAINT "seller_order_events_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "seller_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_order_events" ADD CONSTRAINT "seller_order_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
