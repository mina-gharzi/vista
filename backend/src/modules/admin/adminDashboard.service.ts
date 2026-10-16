import type { AdminDashboard } from "@vista/shared";
import type { AdminDashboardRepository } from "./adminDashboard.repository";

export interface AdminDashboardService {
  get(): Promise<AdminDashboard>;
}

/**
 * معناشناسی: «سفارش‌ها» = سفارش‌های ثبت‌شده به تفکیک وضعیت پرداخت؛ «درآمد» عمداً نیست چون تراکنش
 * پرداخت واقعی و تأییدشده‌ای وجود ندارد (PAID در توسعه با Mock ساخته می‌شود و گواه فروش نیست).
 */
export function createAdminDashboardService(repository: AdminDashboardRepository): AdminDashboardService {
  return {
    async get() {
      const data = await repository.load();
      return {
        customers: data.customers,
        sellers: data.sellers,
        products: data.products,
        orders: data.orders,
        pendingSellerApplications: data.sellers.PENDING,
        recentOrders: data.recentOrders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          totalAmount: order.totalAmount,
          createdAt: order.createdAt.toISOString(),
        })),
        recentSellers: data.recentSellers.map((seller) => ({
          id: seller.id,
          storeName: seller.storeName,
          status: seller.status,
          createdAt: seller.createdAt.toISOString(),
        })),
      };
    },
  };
}
