import type { PaginatedResponse } from "./api";
import type { FulfillmentStatus } from "./order";

/**
 * مدیریت سفارش‌های فروشنده. «سفارش فروشنده» همان SellerOrder موجود است (نه مدل جدید) و فقط وقتی
 * برای فروشنده دیده می‌شود که Order والد پرداخت‌شده (PAID) باشد؛ همان تعریف داشبورد.
 *
 * چرخه ارسال (یک‌طرفه و بدون پرش):
 *   PENDING (در انتظار آماده‌سازی) → PROCESSING → SHIPPED → DELIVERED
 * CANCELLED پایانی است و فروشنده نمی‌تواند سفارشی را لغو کند (بازگرداندن موجودی هنوز تعریف نشده).
 */
export const SELLER_ORDER_TRANSITIONS: Record<FulfillmentStatus, readonly FulfillmentStatus[]> = {
  PENDING: ["PROCESSING"],
  PROCESSING: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

/** برچسب فارسی وضعیت ارسال؛ منبع واحد برای پیام‌های Backend و UI */
export const FULFILLMENT_STATUS_LABEL: Record<FulfillmentStatus, string> = {
  PENDING: "در انتظار آماده‌سازی",
  PROCESSING: "در حال آماده‌سازی",
  SHIPPED: "ارسال‌شده",
  DELIVERED: "تحویل‌شده",
  CANCELLED: "لغوشده",
};

/** وضعیت‌هایی که فروشنده می‌تواند «به آن‌ها» برود */
export type SellerFulfillmentTarget = "PROCESSING" | "SHIPPED" | "DELIVERED";

/**
 * هر مقصد دقیقاً یک مبدأ معتبر دارد؛ بنابراین بروزرسانی می‌تواند «شرطی» (Compare-and-Set) باشد
 * و دو درخواست همزمان هیچ‌گاه هر دو موفق نمی‌شوند.
 */
export const SELLER_ORDER_SOURCE_STATUS: Record<SellerFulfillmentTarget, FulfillmentStatus> = {
  PROCESSING: "PENDING",
  SHIPPED: "PROCESSING",
  DELIVERED: "SHIPPED",
};

export interface SellerOrderListItem {
  /** شناسه SellerOrder (نه Order والد) */
  id: string;
  orderNumber: number;
  createdAt: string;
  status: FulfillmentStatus;
  /** جمع مبلغ اقلام «همین فروشنده» (تومان) */
  subtotal: number;
  /** مجموع تعداد اقلام همین فروشنده */
  itemCount: number;
  previewImageUrl: string | null;
  trackingCode: string | null;
}

export interface SellerOrderLine {
  id: string;
  productTitle: string;
  sku: string;
  size: string;
  color: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/** فقط آنچه برای ارسال لازم است؛ ایمیل یا شناسه کاربری مشتری هرگز نمی‌آید */
export interface SellerOrderShipping {
  fullName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  addressLine: string;
}

export interface SellerOrderEventEntry {
  id: string;
  fromStatus: FulfillmentStatus;
  toStatus: FulfillmentStatus;
  trackingCode: string | null;
  createdAt: string;
}

export interface SellerOrderDetail {
  id: string;
  orderNumber: number;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  status: FulfillmentStatus;
  /** جمع اقلام همین فروشنده؛ هزینه ارسال/تخفیف سطح سفارش والد است و برای فروشنده نمایش داده نمی‌شود */
  subtotal: number;
  trackingCode: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: SellerOrderLine[];
  /** برای سفارش لغوشده null است (دیگر برای ارسال لازم نیست) */
  shipping: SellerOrderShipping | null;
  /** وضعیت‌هایی که همین الان مجازند (Backend تعیین می‌کند؛ UI فقط نمایش می‌دهد) */
  allowedTransitions: SellerFulfillmentTarget[];
  history: SellerOrderEventEntry[];
}

export interface SellerOrderStatusTotals {
  count: number;
  /** جمع subtotal همین وضعیت (تومان) */
  total: number;
}

export interface SellerOrdersOverview {
  byStatus: Record<FulfillmentStatus, SellerOrderStatusTotals>;
  totalOrders: number;
}

export type SellerOrderList = PaginatedResponse<SellerOrderListItem>;
