import type { Prisma, PrismaClient } from "@prisma/client";
import type { FulfillmentStatus } from "@vista/shared";

export interface SellerOrderListRow {
  id: string;
  orderNumber: number;
  createdAt: Date;
  status: FulfillmentStatus;
  subtotal: number;
  trackingCode: string | null;
  items: { quantity: number; imageUrl: string | null }[];
}

export interface SellerOrderItemRow {
  id: string;
  productTitle: string;
  sku: string;
  size: string;
  color: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
}

export interface SellerOrderEventRow {
  id: string;
  fromStatus: FulfillmentStatus;
  toStatus: FulfillmentStatus;
  trackingCode: string | null;
  createdAt: Date;
}

export interface SellerOrderDetailRow {
  id: string;
  orderNumber: number;
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date | null;
  status: FulfillmentStatus;
  subtotal: number;
  trackingCode: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  items: SellerOrderItemRow[];
  shipping: {
    fullName: string;
    phone: string;
    province: string;
    city: string;
    postalCode: string;
    addressLine: string;
  };
  events: SellerOrderEventRow[];
}

export interface SellerOrdersListParams {
  page: number;
  limit: number;
  status?: FulfillmentStatus | undefined;
  /** شروع روز (شامل) */
  from?: Date | undefined;
  /** شروع روز بعد (انحصاری) */
  toExclusive?: Date | undefined;
  orderNumber?: number | undefined;
}

export interface StatusAggregateRow {
  status: FulfillmentStatus;
  count: number;
  total: number;
}

export interface TransitionChange {
  /** تنها مبدأ معتبر؛ بروزرسانی فقط اگر وضعیت فعلی دقیقاً همین باشد (Compare-and-Set) */
  from: FulfillmentStatus;
  to: FulfillmentStatus;
  trackingCode: string | null;
  /** از توکن احراز هویت، نه از Body */
  actorId: string;
}

/**
 * «همه» متدها sellerId را می‌گیرند که فقط از رابطه کاربر احراز‌شده → Seller می‌آید.
 * سفارش فقط وقتی برای فروشنده «وجود دارد» که Order والد PAID باشد (هم‌تعریف داشبورد).
 */
export interface SellerOrdersRepository {
  findSellerByUserId(userId: string): Promise<{ id: string; status: string } | null>;
  list(
    sellerId: string,
    params: SellerOrdersListParams,
  ): Promise<{ items: SellerOrderListRow[]; total: number }>;
  /** یک Query تجمیعی (GROUP BY)؛ هیچ سفارشی در حافظه شمرده نمی‌شود */
  aggregateByStatus(sellerId: string): Promise<StatusAggregateRow[]>;
  findOwned(sellerId: string, sellerOrderId: string): Promise<SellerOrderDetailRow | null>;
  /**
   * وضعیت + رویداد تاریخچه در «یک» Transaction. فقط وقتی انجام می‌شود که سفارش مال این فروشنده باشد،
   * Order والد PAID باشد و وضعیت فعلی (به‌صورت Compare-and-Set در خود UPDATE) برابر change.from باشد. در غیر این صورت null (هیچ تغییری نمی‌کند).
   * این Repository عمداً هیچ دسترسی‌ای به موجودی (stock/InventoryMovement) ندارد.
   */
  applyTransition(
    sellerId: string,
    sellerOrderId: string,
    change: TransitionChange,
  ): Promise<SellerOrderDetailRow | null>;
}

const DETAIL_SELECT = {
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  subtotal: true,
  trackingCode: true,
  shippedAt: true,
  deliveredAt: true,
  order: {
    select: {
      orderNumber: true,
      paidAt: true,
      shippingFullName: true,
      shippingPhone: true,
      shippingProvince: true,
      shippingCity: true,
      shippingPostalCode: true,
      shippingAddressLine: true,
    },
  },
  items: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      productTitle: true,
      sku: true,
      size: true,
      color: true,
      imageUrl: true,
      quantity: true,
      unitPrice: true,
    },
  },
  events: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, fromStatus: true, toStatus: true, trackingCode: true, createdAt: true },
  },
} satisfies Prisma.SellerOrderSelect;

type DetailPayload = Prisma.SellerOrderGetPayload<{ select: typeof DETAIL_SELECT }>;

function toDetailRow(row: DetailPayload): SellerOrderDetailRow {
  return {
    id: row.id,
    orderNumber: row.order.orderNumber,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    paidAt: row.order.paidAt,
    status: row.status,
    subtotal: row.subtotal,
    trackingCode: row.trackingCode,
    shippedAt: row.shippedAt,
    deliveredAt: row.deliveredAt,
    items: row.items,
    shipping: {
      fullName: row.order.shippingFullName,
      phone: row.order.shippingPhone,
      province: row.order.shippingProvince,
      city: row.order.shippingCity,
      postalCode: row.order.shippingPostalCode,
      addressLine: row.order.shippingAddressLine,
    },
    events: row.events,
  };
}

const LIST_SELECT = {
  id: true,
  createdAt: true,
  status: true,
  subtotal: true,
  trackingCode: true,
  order: { select: { orderNumber: true } },
  items: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { quantity: true, imageUrl: true } },
} satisfies Prisma.SellerOrderSelect;

/** sellerId و پرداخت‌شدن والد داخل خود شرط Query هستند: سفارش فروشنده دیگر هرگز خوانده نمی‌شود */
function visibleTo(sellerId: string): Prisma.SellerOrderWhereInput {
  return { sellerId, order: { status: "PAID" } };
}

export function createSellerOrdersRepository(prisma: PrismaClient): SellerOrdersRepository {
  return {
    async findSellerByUserId(userId) {
      return prisma.seller.findUnique({ where: { userId }, select: { id: true, status: true } });
    },

    async list(sellerId, { page, limit, status, from, toExclusive, orderNumber }) {
      const where: Prisma.SellerOrderWhereInput = {
        sellerId,
        order: { status: "PAID", ...(orderNumber !== undefined ? { orderNumber } : {}) },
        ...(status ? { status } : {}),
        ...(from || toExclusive
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(toExclusive ? { lt: toExclusive } : {}),
              },
            }
          : {}),
      };
      // یک Query برای ردیف‌ها (اقلام با include، بدون N+1) و یکی برای total
      const [rows, total] = await Promise.all([
        prisma.sellerOrder.findMany({
          where,
          select: LIST_SELECT,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.sellerOrder.count({ where }),
      ]);
      return {
        items: rows.map((row) => ({
          id: row.id,
          orderNumber: row.order.orderNumber,
          createdAt: row.createdAt,
          status: row.status,
          subtotal: row.subtotal,
          trackingCode: row.trackingCode,
          items: row.items,
        })),
        total,
      };
    },

    async aggregateByStatus(sellerId) {
      const groups = await prisma.sellerOrder.groupBy({
        by: ["status"],
        where: visibleTo(sellerId),
        _count: { _all: true },
        _sum: { subtotal: true },
      });
      return groups.map((group) => ({
        status: group.status,
        count: group._count._all,
        total: group._sum.subtotal ?? 0,
      }));
    },

    async findOwned(sellerId, sellerOrderId) {
      const row = await prisma.sellerOrder.findFirst({
        where: { id: sellerOrderId, ...visibleTo(sellerId) },
        select: DETAIL_SELECT,
      });
      return row ? toDetailRow(row) : null;
    },

    async applyTransition(sellerId, sellerOrderId, { from, to, trackingCode, actorId }) {
      return prisma.$transaction(async (tx) => {
        // ۱) مالکیت و PAID بودن والد (فیلتر رابطه‌ای فقط برای «خواندن»)
        const eligible = await tx.sellerOrder.findFirst({
          where: { id: sellerOrderId, ...visibleTo(sellerId) },
          select: { id: true },
        });
        if (!eligible) return null;

        // ۲) Compare-and-Set: «فقط» شرط‌های اسکالر خود seller_orders (id + sellerId + وضعیت مبدأ)، تا
        // Prisma آن را به یک UPDATE ... WHERE تکی ترجمه کند (مثل کسر موجودی در Checkout). عمداً فیلتر
        // رابطه‌ای در این UPDATE نیست، چون ممکن است به «خواندن id ها و سپس UPDATE بر اساس id» تبدیل شود
        // و شرط وضعیت از خود UPDATE بیفتد. از دو درخواست همزمان فقط یکی count=1 می‌گیرد.
        const now = new Date();
        const updated = await tx.sellerOrder.updateMany({
          where: { id: sellerOrderId, sellerId, status: from },
          data: {
            status: to,
            ...(to === "SHIPPED" ? { trackingCode, shippedAt: now } : {}),
            ...(to === "DELIVERED" ? { deliveredAt: now } : {}),
          },
        });
        if (updated.count !== 1) return null;

        await tx.sellerOrderEvent.create({
          data: {
            sellerOrderId,
            fromStatus: from,
            toStatus: to,
            trackingCode: to === "SHIPPED" ? trackingCode : null,
            actorId,
          },
          select: { id: true },
        });
        const row = await tx.sellerOrder.findUniqueOrThrow({
          where: { id: sellerOrderId },
          select: DETAIL_SELECT,
        });
        return toDetailRow(row);
      });
    },
  };
}
