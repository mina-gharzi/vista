import type { Prisma } from "@prisma/client";
import type { FulfillmentStatus, SellerStatus } from "@vista/shared";

export interface DashboardSellerRecord {
  id: string;
  storeName: string;
  storeSlug: string;
  status: SellerStatus;
}

export interface OrderAggregateRow {
  status: FulfillmentStatus;
  count: number;
  /** جمع subtotal این وضعیت (تومان) */
  sales: number;
}

export interface RecentOrderRow {
  id: string;
  orderNumber: number;
  createdAt: Date;
  status: FulfillmentStatus;
  subtotal: number;
  /** مجموع quantity اقلام */
  itemCount: number;
}

export interface StockAlertRow {
  variantId: string;
  productId: string;
  productTitle: string;
  size: string;
  color: string;
  stock: number;
}

/**
 * قرارداد خواندن داده داشبورد. «همه» متدها sellerId را می‌گیرند و Service آن را فقط از
 * رابطه کاربر احراز‌شده → Seller به‌دست می‌آورد؛ هرگز از ورودی Client.
 * این Repository فقط می‌خواند (هیچ Mutation روی موجودی یا سفارش ندارد).
 */
export interface SellerDashboardRepository {
  findSellerByUserId(userId: string): Promise<DashboardSellerRecord | null>;
  /** سفارش‌های «پرداخت‌شده» همین فروشنده به تفکیک وضعیت — یک Query تجمیعی (GROUP BY) */
  getOrderAggregates(sellerId: string): Promise<OrderAggregateRow[]>;
  getProductCounts(sellerId: string): Promise<{ productCount: number; publishedProductCount: number }>;
  getStockCounts(
    sellerId: string,
    lowStockThreshold: number,
  ): Promise<{ lowStockCount: number; outOfStockCount: number }>;
  getStockAlerts(
    sellerId: string,
    lowStockThreshold: number,
    limit: number,
  ): Promise<{ lowStock: StockAlertRow[]; outOfStock: StockAlertRow[] }>;
  getRecentOrders(sellerId: string, limit: number): Promise<RecentOrderRow[]>;
}

/** فقط محصولات منتشرشده در هشدار موجودی می‌آیند (پیش‌نویس/آرشیو فروخته نمی‌شوند). */
function publishedVariantsOf(sellerId: string): Prisma.ProductVariantWhereInput {
  return { product: { sellerId, status: "PUBLISHED" } };
}

/** سفارش‌های واقعی فروشنده: فقط Orderهای پرداخت‌شده (PENDING/CANCELLED/REFUNDED محاسبه نمی‌شوند). */
function paidSellerOrdersOf(sellerId: string): Prisma.SellerOrderWhereInput {
  return { sellerId, order: { status: "PAID" } };
}

const ALERT_SELECT = {
  id: true,
  size: true,
  color: true,
  stock: true,
  product: { select: { id: true, title: true } },
} satisfies Prisma.ProductVariantSelect;

type AlertVariant = Prisma.ProductVariantGetPayload<{ select: typeof ALERT_SELECT }>;

function toAlertRow(variant: AlertVariant): StockAlertRow {
  return {
    variantId: variant.id,
    productId: variant.product.id,
    productTitle: variant.product.title,
    size: variant.size,
    color: variant.color,
    stock: variant.stock,
  };
}

/** Prisma.TransactionClient عمداً: هم PrismaClient و هم Client داخل Transaction (تست‌های Rollback) را می‌پذیرد. */
export function createSellerDashboardRepository(
  prisma: Prisma.TransactionClient,
): SellerDashboardRepository {
  return {
    findSellerByUserId(userId) {
      return prisma.seller.findUnique({
        where: { userId },
        select: { id: true, storeName: true, storeSlug: true, status: true },
      });
    },

    async getOrderAggregates(sellerId) {
      const groups = await prisma.sellerOrder.groupBy({
        by: ["status"],
        where: paidSellerOrdersOf(sellerId),
        _count: { _all: true },
        _sum: { subtotal: true },
      });
      return groups.map((group) => ({
        status: group.status,
        count: group._count._all,
        sales: group._sum.subtotal ?? 0,
      }));
    },

    async getProductCounts(sellerId) {
      const [productCount, publishedProductCount] = await Promise.all([
        prisma.product.count({ where: { sellerId, status: { not: "ARCHIVED" } } }),
        prisma.product.count({ where: { sellerId, status: "PUBLISHED" } }),
      ]);
      return { productCount, publishedProductCount };
    },

    async getStockCounts(sellerId, lowStockThreshold) {
      const [lowStockCount, outOfStockCount] = await Promise.all([
        prisma.productVariant.count({
          where: { ...publishedVariantsOf(sellerId), stock: { gt: 0, lte: lowStockThreshold } },
        }),
        prisma.productVariant.count({
          where: { ...publishedVariantsOf(sellerId), stock: { lte: 0 } },
        }),
      ]);
      return { lowStockCount, outOfStockCount };
    },

    async getStockAlerts(sellerId, lowStockThreshold, limit) {
      const [low, out] = await Promise.all([
        prisma.productVariant.findMany({
          where: { ...publishedVariantsOf(sellerId), stock: { gt: 0, lte: lowStockThreshold } },
          orderBy: [{ stock: "asc" }, { id: "asc" }],
          take: limit,
          select: ALERT_SELECT,
        }),
        prisma.productVariant.findMany({
          where: { ...publishedVariantsOf(sellerId), stock: { lte: 0 } },
          orderBy: { id: "asc" },
          take: limit,
          select: ALERT_SELECT,
        }),
      ]);
      return { lowStock: low.map(toAlertRow), outOfStock: out.map(toAlertRow) };
    },

    async getRecentOrders(sellerId, limit) {
      const rows = await prisma.sellerOrder.findMany({
        where: paidSellerOrdersOf(sellerId),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        // فقط فیلدهای لازم؛ هیچ اطلاعاتی از مشتری/آدرس خوانده نمی‌شود
        select: {
          id: true,
          status: true,
          subtotal: true,
          createdAt: true,
          order: { select: { orderNumber: true } },
          items: { select: { quantity: true } },
        },
      });
      return rows.map((row) => ({
        id: row.id,
        orderNumber: row.order.orderNumber,
        createdAt: row.createdAt,
        status: row.status,
        subtotal: row.subtotal,
        itemCount: row.items.reduce((sum, item) => sum + item.quantity, 0),
      }));
    },
  };
}
