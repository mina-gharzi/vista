import type { FulfillmentStatus } from "./order";
import type { SellerStatus } from "./seller";

/**
 * آستانه «موجودی کم» برای تمام بخش‌های فروشنده (داشبورد و در آینده Inventory).
 * یک Variant منتشرشده با 0 < stock ≤ این مقدار «رو به اتمام» و با stock = 0 «ناموجود» است.
 */
export const LOW_STOCK_THRESHOLD = 5;

export interface SellerDashboardSeller {
  id: string;
  storeName: string;
  slug: string;
  status: SellerStatus;
}

export interface SellerDashboardSummary {
  /** جمع مبلغ سفارش‌های پرداخت‌شده «همین فروشنده» (تومان)؛ سفارش‌های لغوشده حساب نمی‌شوند */
  totalSales: number;
  /** تعداد سفارش‌های پرداخت‌شده همین فروشنده، بدون لغوشده‌ها */
  totalOrders: number;
  /** هنوز ارسال نشده‌اند: PENDING + PROCESSING */
  pendingOrders: number;
  /** تحویل‌شده: DELIVERED */
  completedOrders: number;
  /** شکست دقیق بر اساس FulfillmentStatus موجود در سیستم (شامل CANCELLED) */
  ordersByStatus: Record<FulfillmentStatus, number>;
  /** محصولات غیرآرشیو (پیش‌نویس + منتشرشده) */
  productCount: number;
  publishedProductCount: number;
  /** Variantهای محصولات منتشرشده */
  lowStockCount: number;
  outOfStockCount: number;
}

/** عمداً بدون هیچ اطلاعات مشتری (نام، تلفن، آدرس) */
export interface SellerDashboardRecentOrder {
  id: string;
  orderNumber: number;
  createdAt: string;
  status: FulfillmentStatus;
  total: number;
  /** مجموع تعداد اقلام (جمع quantity) */
  itemCount: number;
}

export interface SellerDashboardStockAlert {
  variantId: string;
  productId: string;
  productTitle: string;
  size: string;
  color: string;
  stock: number;
}

export interface SellerDashboard {
  seller: SellerDashboardSeller;
  summary: SellerDashboardSummary;
  recentOrders: SellerDashboardRecentOrder[];
  inventoryAlerts: {
    lowStockThreshold: number;
    /** حداکثر چند مورد اول (کم‌ترین موجودی اول)؛ تعداد کل در summary است */
    lowStock: SellerDashboardStockAlert[];
    outOfStock: SellerDashboardStockAlert[];
  };
}
