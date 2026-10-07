import type { FulfillmentStatus, SellerStatus } from "@vista/shared";
import type {
  DashboardSellerRecord,
  OrderAggregateRow,
  RecentOrderRow,
  SellerDashboardRepository,
  StockAlertRow,
} from "../../src/modules/sellerDashboard/sellerDashboard.repository";

type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type PaymentStatus = "PENDING" | "PAID" | "CANCELLED" | "REFUNDED";

interface FakeSeller extends DashboardSellerRecord {
  userId: string;
}
interface FakeProduct {
  id: string;
  sellerId: string;
  title: string;
  status: ProductStatus;
}
interface FakeVariant {
  id: string;
  productId: string;
  size: string;
  color: string;
  stock: number;
}
interface FakeSellerOrder {
  id: string;
  sellerId: string;
  orderNumber: number;
  paymentStatus: PaymentStatus;
  status: FulfillmentStatus;
  subtotal: number;
  createdAt: Date;
  quantities: number[];
}

/**
 * Repository درون‌حافظه‌ای که «همان قرارداد» Repository واقعی را پیاده می‌کند:
 * همه Queryها فقط با sellerId فیلتر می‌شوند و فقط سفارش‌های PAID / محصولات PUBLISHED حساب می‌شوند.
 * داده چند فروشنده همزمان در آن نگه داشته می‌شود تا نشت داده بین فروشندگان قابل تست باشد.
 */
export function createFakeDashboardRepository() {
  const sellers: FakeSeller[] = [];
  const products: FakeProduct[] = [];
  const variants: FakeVariant[] = [];
  const sellerOrders: FakeSellerOrder[] = [];
  let seq = 0;
  // شناسه‌های هم‌طول: "seller-0001" هرگز زیررشته "seller-0016" نیست (تست نشت داده با includes)
  const nextId = (prefix: string) => `${prefix}-${String(++seq).padStart(4, "0")}`;

  const productOf = (variant: FakeVariant) => products.find((p) => p.id === variant.productId);
  const publishedVariantsOf = (sellerId: string) =>
    variants.filter((v) => {
      const product = productOf(v);
      return product?.sellerId === sellerId && product.status === "PUBLISHED";
    });
  const paidOrdersOf = (sellerId: string) =>
    sellerOrders.filter((o) => o.sellerId === sellerId && o.paymentStatus === "PAID");
  const toAlert = (variant: FakeVariant): StockAlertRow => ({
    variantId: variant.id,
    productId: variant.productId,
    productTitle: productOf(variant)?.title ?? "",
    size: variant.size,
    color: variant.color,
    stock: variant.stock,
  });

  const repository: SellerDashboardRepository = {
    async findSellerByUserId(userId) {
      const found = sellers.find((s) => s.userId === userId);
      if (!found) return null;
      const { userId: _userId, ...record } = found;
      return record;
    },

    async getOrderAggregates(sellerId) {
      const byStatus = new Map<FulfillmentStatus, OrderAggregateRow>();
      for (const order of paidOrdersOf(sellerId)) {
        const row = byStatus.get(order.status) ?? { status: order.status, count: 0, sales: 0 };
        row.count += 1;
        row.sales += order.subtotal;
        byStatus.set(order.status, row);
      }
      return [...byStatus.values()];
    },

    async getProductCounts(sellerId) {
      const own = products.filter((p) => p.sellerId === sellerId);
      return {
        productCount: own.filter((p) => p.status !== "ARCHIVED").length,
        publishedProductCount: own.filter((p) => p.status === "PUBLISHED").length,
      };
    },

    async getStockCounts(sellerId, threshold) {
      const own = publishedVariantsOf(sellerId);
      return {
        lowStockCount: own.filter((v) => v.stock > 0 && v.stock <= threshold).length,
        outOfStockCount: own.filter((v) => v.stock <= 0).length,
      };
    },

    async getStockAlerts(sellerId, threshold, limit) {
      const own = publishedVariantsOf(sellerId);
      return {
        lowStock: own
          .filter((v) => v.stock > 0 && v.stock <= threshold)
          .sort((a, b) => a.stock - b.stock || a.id.localeCompare(b.id))
          .slice(0, limit)
          .map(toAlert),
        outOfStock: own
          .filter((v) => v.stock <= 0)
          .sort((a, b) => a.id.localeCompare(b.id))
          .slice(0, limit)
          .map(toAlert),
      };
    },

    async getRecentOrders(sellerId, limit) {
      return paidOrdersOf(sellerId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)
        .map<RecentOrderRow>((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          createdAt: o.createdAt,
          status: o.status,
          subtotal: o.subtotal,
          itemCount: o.quantities.reduce((sum, q) => sum + q, 0),
        }));
    },
  };

  return {
    repository,
    addSeller(userId: string, status: SellerStatus, storeSlug: string, storeName = "فروشگاه") {
      const seller = { id: nextId("seller"), userId, storeName, storeSlug, status };
      sellers.push(seller);
      return seller.id;
    },
    addProduct(sellerId: string, title: string, status: ProductStatus = "PUBLISHED") {
      const product = { id: nextId("product"), sellerId, title, status };
      products.push(product);
      return product.id;
    },
    addVariant(productId: string, stock: number, size = "M", color = "مشکی") {
      const variant = { id: nextId("variant"), productId, size, color, stock };
      variants.push(variant);
      return variant.id;
    },
    addSellerOrder(
      sellerId: string,
      input: {
        orderNumber: number;
        subtotal: number;
        status?: FulfillmentStatus;
        paymentStatus?: PaymentStatus;
        createdAt?: Date;
        quantities?: number[];
      },
    ) {
      sellerOrders.push({
        id: nextId("so"),
        sellerId,
        orderNumber: input.orderNumber,
        paymentStatus: input.paymentStatus ?? "PAID",
        status: input.status ?? "PENDING",
        subtotal: input.subtotal,
        createdAt: input.createdAt ?? new Date(Date.UTC(2026, 0, 1, 0, 0, seq)),
        quantities: input.quantities ?? [1],
      });
    },
  };
}
