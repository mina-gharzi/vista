export type OrderStatus = "PENDING" | "PAID" | "CANCELLED" | "REFUNDED";
export type FulfillmentStatus = "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export interface OrderItemSummary {
  id: string;
  productSlug: string;
  productTitle: string;
  size: string;
  color: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface SellerOrderSummary {
  id: string;
  sellerStoreName: string;
  status: FulfillmentStatus;
  /** جمع ناخالص کالاهای همین فروشنده (قبل از تخفیف) */
  subtotal: number;
  /** سهم همین فروشنده از تخفیف کوپن؛ جمع این سهم‌ها همیشه برابر OrderDetail.discountAmount است */
  discountAmount: number;
  /** کد رهگیری فقط بعد از ارسال توسط فروشنده پر می‌شود */
  trackingCode: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: OrderItemSummary[];
}

/**
 * خلاصهٔ پیشرفت ارسال «والد» که فقط از وضعیت SellerOrderها محاسبه می‌شود (ذخیره نمی‌شود،
 * پس هرگز با وضعیت فروشنده‌ها ناهماهنگ نمی‌شود). نگاه کنید به orderLifecycle.ts.
 */
export type OrderFulfillmentState =
  | "PENDING"
  | "PROCESSING"
  | "PARTIALLY_SHIPPED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export interface OrderFulfillmentSummary {
  state: OrderFulfillmentState;
  /** تعداد بسته‌های فعال (غیرلغوشده) */
  totalParcels: number;
  shippedParcels: number;
  deliveredParcels: number;
}

/** نمای فشرده برای فهرست سفارش‌ها */
export interface OrderListItem {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  totalAmount: number;
  itemCount: number;
  previewImageUrl: string | null;
  fulfillment: OrderFulfillmentSummary;
  /** تصمیم نهایی با Server است؛ این فقط برای نمایش/عدم‌نمایش دکمه است */
  canCancel: boolean;
  createdAt: string;
}

export interface ShippingAddressSnapshot {
  fullName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  addressLine: string;
}

export interface OrderDetail {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  /** Snapshot کد کوپن در لحظهٔ ثبت؛ با ویرایش/غیرفعال‌سازی بعدی کوپن عوض نمی‌شود */
  couponCode: string | null;
  totalAmount: number;
  shippingAddress: ShippingAddressSnapshot;
  sellerOrders: SellerOrderSummary[];
  fulfillment: OrderFulfillmentSummary;
  canCancel: boolean;
  createdAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
}
