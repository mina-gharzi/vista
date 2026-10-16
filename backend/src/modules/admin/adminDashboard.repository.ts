import type { PrismaClient } from "@prisma/client";
import type { OrderStatus, ProductStatusValue, SellerStatus } from "@vista/shared";

export interface DashboardData {
  customers: number;
  sellers: Record<SellerStatus, number>;
  products: Record<ProductStatusValue, number>;
  orders: Record<OrderStatus, number>;
  recentOrders: { id: string; orderNumber: number; status: OrderStatus; totalAmount: number; createdAt: Date }[];
  recentSellers: { id: string; storeName: string; status: SellerStatus; createdAt: Date }[];
}

export interface AdminDashboardRepository {
  load(): Promise<DashboardData>;
}

const RECENT_LIMIT = 5;

export function createAdminDashboardRepository(prisma: PrismaClient): AdminDashboardRepository {
  return {
    async load() {
      // فقط ۶ Query سبک (۴ groupBy/count + ۲ فهرست ۵تایی)، همه موازی؛ بدون خواندن ردیف‌های انبوه
      const [customers, sellerGroups, productGroups, orderGroups, recentOrders, recentSellers] =
        await Promise.all([
          prisma.user.count({ where: { role: "CUSTOMER" } }),
          prisma.seller.groupBy({ by: ["status"], _count: { _all: true } }),
          prisma.product.groupBy({ by: ["status"], _count: { _all: true } }),
          prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
          prisma.order.findMany({
            select: { id: true, orderNumber: true, status: true, totalAmount: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: RECENT_LIMIT,
          }),
          prisma.seller.findMany({
            select: { id: true, storeName: true, status: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: RECENT_LIMIT,
          }),
        ]);

      const sellers: Record<SellerStatus, number> = { PENDING: 0, APPROVED: 0, SUSPENDED: 0, REJECTED: 0 };
      for (const group of sellerGroups) sellers[group.status] = group._count._all;
      const products: Record<ProductStatusValue, number> = { DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 };
      for (const group of productGroups) products[group.status] = group._count._all;
      const orders: Record<OrderStatus, number> = { PENDING: 0, PAID: 0, CANCELLED: 0, REFUNDED: 0 };
      for (const group of orderGroups) orders[group.status] = group._count._all;

      return { customers, sellers, products, orders, recentOrders, recentSellers };
    },
  };
}
