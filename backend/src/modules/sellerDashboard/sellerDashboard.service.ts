import {
  LOW_STOCK_THRESHOLD,
  type FulfillmentStatus,
  type SellerDashboard,
  type SellerStatus,
} from "@vista/shared";
import { AuthorizationError } from "../../errors/AppError";
import type { SellerDashboardRepository } from "./sellerDashboard.repository";

export const RECENT_ORDERS_LIMIT = 5;
export const STOCK_ALERTS_LIMIT = 5;

const FULFILLMENT_STATUSES: readonly FulfillmentStatus[] = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

const DENIED_MESSAGES: Record<Exclude<SellerStatus, "APPROVED">, string> = {
  PENDING: "درخواست فروشندگی شما هنوز در انتظار بررسی است",
  REJECTED: "درخواست فروشندگی شما تأیید نشده است",
  SUSPENDED: "حساب فروشندگی شما تعلیق شده است",
};

export interface SellerDashboardService {
  getDashboard(userId: string): Promise<SellerDashboard>;
}

export function createSellerDashboardService(
  repository: SellerDashboardRepository,
): SellerDashboardService {
  return {
    async getDashboard(userId) {
      // زنجیره مالکیت: کاربر احراز‌شده (از توکن) → Seller خودش. sellerId هرگز از Client نمی‌آید.
      const seller = await repository.findSellerByUserId(userId);
      if (!seller) {
        throw new AuthorizationError("برای دسترسی به داشبورد ابتدا باید فروشنده شوید");
      }
      if (seller.status !== "APPROVED") {
        throw new AuthorizationError(DENIED_MESSAGES[seller.status]);
      }

      const [aggregates, products, stockCounts, alerts, recentOrders] = await Promise.all([
        repository.getOrderAggregates(seller.id),
        repository.getProductCounts(seller.id),
        repository.getStockCounts(seller.id, LOW_STOCK_THRESHOLD),
        repository.getStockAlerts(seller.id, LOW_STOCK_THRESHOLD, STOCK_ALERTS_LIMIT),
        repository.getRecentOrders(seller.id, RECENT_ORDERS_LIMIT),
      ]);

      const ordersByStatus = Object.fromEntries(
        FULFILLMENT_STATUSES.map((status) => [status, 0]),
      ) as Record<FulfillmentStatus, number>;
      let totalSales = 0;
      let totalOrders = 0;

      for (const row of aggregates) {
        ordersByStatus[row.status] += row.count;
        // سفارش لغوشده فروش حساب نمی‌شود
        if (row.status !== "CANCELLED") {
          totalSales += row.sales;
          totalOrders += row.count;
        }
      }

      return {
        seller: {
          id: seller.id,
          storeName: seller.storeName,
          slug: seller.storeSlug,
          status: seller.status,
        },
        summary: {
          totalSales,
          totalOrders,
          pendingOrders: ordersByStatus.PENDING + ordersByStatus.PROCESSING,
          completedOrders: ordersByStatus.DELIVERED,
          ordersByStatus,
          productCount: products.productCount,
          publishedProductCount: products.publishedProductCount,
          lowStockCount: stockCounts.lowStockCount,
          outOfStockCount: stockCounts.outOfStockCount,
        },
        recentOrders: recentOrders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt.toISOString(),
          status: order.status,
          total: order.subtotal,
          itemCount: order.itemCount,
        })),
        inventoryAlerts: {
          lowStockThreshold: LOW_STOCK_THRESHOLD,
          lowStock: alerts.lowStock,
          outOfStock: alerts.outOfStock,
        },
      };
    },
  };
}
