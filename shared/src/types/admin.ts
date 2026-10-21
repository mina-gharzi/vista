import type { PaginatedResponse } from "./api";
import type {
  FulfillmentStatus,
  OrderFulfillmentSummary,
  OrderStatus,
  ShippingAddressSnapshot,
} from "./order";
import type { SellerStatus } from "./seller";

/**
 * پنل ادمین. دسترسی فقط با نقش ADMIN «در دیتابیس» (نه نقش داخل توکن) و فقط سمت Server.
 * هر تغییر مهم یک ردیف AdminAuditLog (فقط‌افزودنی) می‌سازد؛ هویت ادمین از توکن می‌آید، نه Body.
 */

export type ProductStatusValue = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/** مقصدهایی که ادمین می‌تواند برای فروشنده تعیین کند (PENDING فقط با ثبت‌نام/ارسال مجدد خود کاربر است) */
export type SellerAdminTarget = "APPROVED" | "REJECTED" | "SUSPENDED";

/**
 * انتقال‌های مجاز فروشنده توسط ادمین:
 *  PENDING → APPROVED | REJECTED ، APPROVED → SUSPENDED ، SUSPENDED → APPROVED (فعال‌سازی مجدد).
 *  REJECTED پایانی است: فقط خود کاربر با «ارسال مجدد» به PENDING برمی‌گردد (Flow موجود Onboarding).
 */
export const SELLER_ADMIN_TRANSITIONS: Record<SellerStatus, readonly SellerAdminTarget[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["SUSPENDED"],
  SUSPENDED: ["APPROVED"],
  REJECTED: [],
};

/** برای رد و تعلیق، ثبت دلیل اجباری است (فروشنده/تاریخچه باید علت را بدانند) */
export const SELLER_TARGETS_REQUIRING_REASON: readonly SellerAdminTarget[] = ["REJECTED", "SUSPENDED"];

export const SELLER_STATUS_LABEL: Record<SellerStatus, string> = {
  PENDING: "در انتظار بررسی",
  APPROVED: "تأییدشده",
  SUSPENDED: "تعلیق‌شده",
  REJECTED: "ردشده",
};

/**
 * محصول: چرخهٔ موجود (DRAFT/PUBLISHED/ARCHIVED) بدون وضعیت جدید.
 * ادمین فقط «لغو انتشار» (PUBLISHED→DRAFT) و «بایگانی/رد» (→ARCHIVED، پایانی) را انجام می‌دهد؛ انتشار
 * همچنان با فروشنده است (شرایط انتشار مثل تصویر و تنوع در سمت فروشنده بررسی می‌شود).
 */
export type ProductAdminTarget = "DRAFT" | "ARCHIVED";
export const PRODUCT_ADMIN_TRANSITIONS: Record<ProductStatusValue, readonly ProductAdminTarget[]> = {
  PUBLISHED: ["DRAFT", "ARCHIVED"],
  DRAFT: ["ARCHIVED"],
  ARCHIVED: [],
};

export const PRODUCT_STATUS_LABEL: Record<ProductStatusValue, string> = {
  DRAFT: "پیش‌نویس",
  PUBLISHED: "منتشرشده",
  ARCHIVED: "بایگانی‌شده",
};

export type AdminAuditAction =
  | "SELLER_STATUS_CHANGED"
  | "PRODUCT_STATUS_CHANGED"
  | "CATEGORY_CREATED"
  | "CATEGORY_UPDATED"
  | "CATEGORY_DELETED"
  | "COUPON_CREATED"
  | "COUPON_UPDATED"
  | "COUPON_STATUS_CHANGED";

export type AdminAuditTargetType = "SELLER" | "PRODUCT" | "CATEGORY" | "COUPON";

export interface AdminAuditEntry {
  id: string;
  action: AdminAuditAction;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  adminName: string;
  createdAt: string;
}

// ───────── داشبورد ─────────

export interface AdminRecentOrder {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
}

export interface AdminRecentSeller {
  id: string;
  storeName: string;
  status: SellerStatus;
  createdAt: string;
}

/**
 * معناشناسی: «سفارش‌ها» = سفارش‌های «ثبت‌شده» به تفکیک وضعیت «پرداخت». هیچ درآمد/فروش قطعی نمایش
 * داده نمی‌شود چون هنوز درگاه پرداخت واقعی و تأیید تراکنش وجود ندارد.
 */
export interface AdminDashboard {
  customers: number;
  sellers: Record<SellerStatus, number>;
  products: Record<ProductStatusValue, number>;
  orders: Record<OrderStatus, number>;
  pendingSellerApplications: number;
  recentOrders: AdminRecentOrder[];
  recentSellers: AdminRecentSeller[];
}

// ───────── فروشندگان ─────────

export interface AdminSellerListItem {
  id: string;
  storeName: string;
  storeSlug: string;
  status: SellerStatus;
  ownerName: string;
  ownerEmail: string;
  productCount: number;
  createdAt: string;
}

export interface AdminSellerDetail {
  id: string;
  storeName: string;
  storeSlug: string;
  description: string | null;
  status: SellerStatus;
  statusReason: string | null;
  statusChangedAt: string | null;
  createdAt: string;
  owner: { name: string; email: string; phone: string | null; registeredAt: string };
  products: Record<ProductStatusValue, number>;
  sellerOrderCount: number;
  /** وضعیت‌هایی که ادمین همین حالا می‌تواند انتخاب کند (تصمیم نهایی با Server) */
  allowedTransitions: SellerAdminTarget[];
  history: AdminAuditEntry[];
}

export type AdminSellerList = PaginatedResponse<AdminSellerListItem>;

// ───────── محصولات ─────────

export interface AdminProductListItem {
  id: string;
  title: string;
  slug: string;
  status: ProductStatusValue;
  basePrice: number;
  categoryName: string;
  sellerId: string;
  sellerName: string;
  sellerStatus: SellerStatus;
  /** محصول متعلق به فروشنده‌ای که «تأییدشده» نیست (برای مشتری نمایش داده نمی‌شود) */
  sellerBlocked: boolean;
  totalStock: number;
  createdAt: string;
}

export interface AdminProductDetail extends AdminProductListItem {
  description: string;
  compareAtPrice: number | null;
  images: { url: string; altText: string | null }[];
  variants: {
    id: string;
    size: string;
    color: string;
    sku: string;
    price: number | null;
    stock: number;
    isActive: boolean;
  }[];
  allowedTransitions: ProductAdminTarget[];
  history: AdminAuditEntry[];
}

export type AdminProductList = PaginatedResponse<AdminProductListItem>;

// ───────── دسته‌بندی ─────────

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  parentId: string | null;
  parentName: string | null;
  productCount: number;
  childCount: number;
}

// ───────── سفارش‌ها ─────────

export interface AdminOrderListItem {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  totalAmount: number;
  customerName: string;
  sellerCount: number;
  fulfillment: OrderFulfillmentSummary;
  createdAt: string;
}

export interface AdminOrderDetail {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  /** Snapshot کد کوپن سفارش (null = بدون کوپن) */
  couponCode: string | null;
  totalAmount: number;
  createdAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  /** فقط اطلاعاتی که پشتیبانی لازم دارد؛ هیچ اطلاعات احراز هویتی نیست */
  customer: { name: string; email: string; phone: string | null };
  shippingAddress: ShippingAddressSnapshot;
  fulfillment: OrderFulfillmentSummary;
  sellerOrders: {
    id: string;
    sellerId: string;
    sellerName: string;
    status: FulfillmentStatus;
    subtotal: number;
    /** سهم همین فروشنده از تخفیف کوپن */
    discountAmount: number;
    trackingCode: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    items: {
      id: string;
      productTitle: string;
      sku: string;
      size: string;
      color: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }[];
    history: {
      id: string;
      fromStatus: FulfillmentStatus;
      toStatus: FulfillmentStatus;
      trackingCode: string | null;
      createdAt: string;
    }[];
  }[];
}

export type AdminOrderList = PaginatedResponse<AdminOrderListItem>;
