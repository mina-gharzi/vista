import { Prisma } from "@prisma/client";
import type { OrderStatus, PrismaClient } from "@prisma/client";
import type { CouponRules } from "../coupons/coupons.engine";
import { countActiveRedemptions, findCouponRulesByCode, loadCategoryParents } from "../coupons/coupons.queries";

/**
 * Repository سفارش‌ها فقط «ابزارهای ساده و اتمیک» دیتابیس را می‌دهد؛ قوانین کسب‌وکار (اعتبارسنجی سبد،
 * قیمت‌گذاری، Idempotency، لغو) در OrdersService است تا بدون دیتابیس واقعی قابل تست باشد.
 * همهٔ نوشتن‌های Checkout/لغو فقط از طریق `transaction` و روی `OrdersTx` انجام می‌شود تا یک تلاش
 * یا کامل ثبت شود یا هیچ اثری نگذارد.
 */

export interface OrderWithRelations {
  id: string;
  orderNumber: number;
  status: string;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  totalAmount: number;
  /** Snapshot کد کوپن در لحظهٔ ثبت سفارش */
  couponCode: string | null;
  shippingFullName: string;
  shippingPhone: string;
  shippingProvince: string;
  shippingCity: string;
  shippingPostalCode: string;
  shippingAddressLine: string;
  createdAt: Date;
  paidAt: Date | null;
  cancelledAt: Date | null;
  sellerOrders: {
    id: string;
    status: string;
    subtotal: number;
    discountAmount: number;
    trackingCode: string | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    seller: { storeName: string };
    items: {
      id: string;
      quantity: number;
      unitPrice: number;
      productTitle: string;
      sku: string;
      size: string;
      color: string;
      imageUrl: string | null;
      variant: { product: { slug: string } };
    }[];
  }[];
}

/** نمای سبک برای فهرست (بدون Join به محصول و بدون اطلاعات اضافی) */
export interface OrderListRow {
  id: string;
  orderNumber: number;
  status: string;
  totalAmount: number;
  createdAt: Date;
  sellerOrders: {
    status: string;
    items: { quantity: number; imageUrl: string | null }[];
  }[];
}

export interface AddressRow {
  id: string;
  fullName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  addressLine: string;
}

/** یک خط سبد همراه با همهٔ داده‌های «قابل اعتماد» از دیتابیس */
export interface CartLine {
  variantId: string;
  productId: string;
  categoryId: string;
  quantity: number;
  variantActive: boolean;
  stock: number;
  variantPrice: number | null;
  basePrice: number;
  productStatus: string;
  productSlug: string;
  productTitle: string;
  imageUrl: string | null;
  sku: string;
  size: string;
  color: string;
  sellerId: string;
  sellerStatus: string;
}

export interface NewOrderData {
  userId: string;
  checkoutKey: string;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  totalAmount: number;
  /** کوپن اعمال‌شده (Snapshot کد) یا null */
  couponId: string | null;
  couponCode: string | null;
  address: Omit<AddressRow, "id">;
  sellerOrders: {
    sellerId: string;
    subtotal: number;
    /** سهم این فروشنده از تخفیف؛ جمع سهم‌ها = discountAmount سفارش */
    discountAmount: number;
    items: {
      variantId: string;
      quantity: number;
      unitPrice: number;
      /** سهم این ردیف از تخفیف */
      discountAmount: number;
      productTitle: string;
      sku: string;
      size: string;
      color: string;
      imageUrl: string | null;
    }[];
  }[];
}

export interface MovementRow {
  variantId: string;
  type: "ORDER_PLACED" | "ORDER_CANCELLED";
  quantityDelta: number;
  stockAfter: number;
  actorId: string;
  orderId: string;
}

/** سفارش قفل‌شده برای لغو */
export interface CancelTarget {
  id: string;
  status: string;
  sellerOrderStatuses: string[];
  items: { variantId: string; quantity: number }[];
}

/** وقتی کلید Checkout قبلاً برای همین کاربر ثبت شده (برخورد با ایندکس یکتا) */
export class DuplicateCheckoutKeyError extends Error {
  constructor() {
    super("duplicate checkout key");
  }
}

/** عملیات داخل یک Transaction دیتابیس */
export interface OrdersTx {
  /** همهٔ Checkout/لغوهای «یک کاربر» را پشت سر هم می‌کند (قفل Advisory تا پایان Transaction) */
  lockUser(userId: string): Promise<void>;
  findByCheckoutKey(userId: string, checkoutKey: string): Promise<OrderWithRelations | null>;
  findAddress(userId: string, addressId: string): Promise<AddressRow | null>;
  loadCartLines(userId: string): Promise<CartLine[]>;
  /** کسر اتمیک و شرطی: فقط اگر stock >= quantity؛ موجودی جدید یا null (ناکافی) */
  decrementStock(variantId: string, quantity: number): Promise<number | null>;
  /** برگرداندن اتمیک موجودی؛ موجودی جدید */
  incrementStock(variantId: string, quantity: number): Promise<number>;
  createOrder(data: NewOrderData): Promise<OrderWithRelations>;
  recordMovements(rows: MovementRow[]): Promise<void>;
  clearCart(userId: string): Promise<void>;
  /** سفارش «متعلق به کاربر» را قفل می‌کند (FOR UPDATE) و برای لغو می‌خواند؛ null اگر مال او نیست */
  lockOwnedOrder(userId: string, orderId: string): Promise<CancelTarget | null>;
  /** Compare-and-Set: PENDING → CANCELLED؛ true فقط اگر همین فراخوانی تغییر را انجام داد */
  markOrderCancelled(orderId: string): Promise<boolean>;
  cancelPendingSellerOrders(orderId: string): Promise<number>;
  findOwnedById(userId: string, orderId: string): Promise<OrderWithRelations | null>;

  // ───── کوپن ─────
  /** `code` نرمال‌شده؛ null = وجود ندارد */
  findCouponByCode(code: string): Promise<CouponRules | null>;
  countActiveRedemptions(couponId: string, userId: string): Promise<number>;
  /** نگاشت دسته → والد برای مشمولیت دستهٔ والد */
  loadCategoryParents(): Promise<Map<string, string | null>>;
  /**
   * مصرف اتمیک یک استفاده: UPDATE شرطی (فعال بودن + usedCount < usageLimit). دو درخواست همزمان روی
   * آخرین ظرفیت هرگز هر دو موفق نمی‌شوند. false = ظرفیت تمام شده یا کوپن همزمان غیرفعال شده.
   */
  tryConsumeCoupon(couponId: string): Promise<boolean>;
  createRedemption(input: {
    couponId: string;
    userId: string;
    orderId: string;
    discountAmount: number;
  }): Promise<void>;
  /**
   * آزادسازی استفادهٔ سفارش لغوشده: Compare-and-Set (ACTIVE → RELEASED) و فقط اگر همین فراخوانی آن را
   * تغییر داد usedCount یکی کم می‌شود؛ لغو مجدد/موازی هرگز دو بار برنمی‌گرداند. false = کوپنی نداشت/قبلاً آزاد شده.
   */
  releaseCouponRedemption(orderId: string): Promise<boolean>;
}

export interface OrdersRepository {
  transaction<T>(work: (tx: OrdersTx) => Promise<T>): Promise<T>;
  /** خارج از Transaction (بعد از Commit)، برای بازیابی نتیجهٔ تلاش تکراری */
  findByCheckoutKey(userId: string, checkoutKey: string): Promise<OrderWithRelations | null>;
  /** Compare-and-Set: PENDING → PAID؛ true فقط اگر همین فراخوانی تغییر را انجام داد */
  markPaid(orderId: string, providerRef: string): Promise<boolean>;
  findById(orderId: string): Promise<OrderWithRelations | null>;
  findManyForUser(
    userId: string,
    params: { page: number; limit: number; status?: string | undefined },
  ): Promise<{ items: OrderListRow[]; total: number }>;
  findOwnedById(userId: string, orderId: string): Promise<OrderWithRelations | null>;
}

const ORDER_INCLUDE = {
  sellerOrders: {
    orderBy: { createdAt: "asc" },
    include: {
      seller: { select: { storeName: true } },
      items: {
        orderBy: { id: "asc" },
        include: { variant: { select: { product: { select: { slug: true } } } } },
      },
    },
  },
} satisfies Prisma.OrderInclude;

const LIST_INCLUDE = {
  sellerOrders: {
    orderBy: { createdAt: "asc" },
    select: {
      status: true,
      items: { orderBy: { id: "asc" }, select: { quantity: true, imageUrl: true } },
    },
  },
} satisfies Prisma.OrderInclude;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** خطوط سبد کاربر با همهٔ داده‌های قابل‌اعتماد؛ بین Checkout و پیش‌نمایش کوپن مشترک است */
export async function queryCartLines(
  db: Pick<Prisma.TransactionClient, "cart">,
  userId: string,
): Promise<CartLine[]> {
  const cart = await db.cart.findUnique({
    where: { userId },
    select: {
      items: {
        orderBy: { variantId: "asc" },
        select: {
          variantId: true,
          quantity: true,
          variant: {
            select: {
              size: true,
              color: true,
              sku: true,
              price: true,
              stock: true,
              isActive: true,
              product: {
                select: {
                  id: true,
                  categoryId: true,
                  slug: true,
                  title: true,
                  basePrice: true,
                  status: true,
                  images: { take: 1, orderBy: { position: "asc" }, select: { url: true } },
                  seller: { select: { id: true, status: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  return (cart?.items ?? []).map((item) => ({
    variantId: item.variantId,
    productId: item.variant.product.id,
    categoryId: item.variant.product.categoryId,
    quantity: item.quantity,
    variantActive: item.variant.isActive,
    stock: item.variant.stock,
    variantPrice: item.variant.price,
    basePrice: item.variant.product.basePrice,
    productStatus: item.variant.product.status,
    productSlug: item.variant.product.slug,
    productTitle: item.variant.product.title,
    imageUrl: item.variant.product.images[0]?.url ?? null,
    sku: item.variant.sku,
    size: item.variant.size,
    color: item.variant.color,
    sellerId: item.variant.product.seller.id,
    sellerStatus: item.variant.product.seller.status,
  }));
}

function createTx(tx: Prisma.TransactionClient): OrdersTx {
  return {
    async lockUser(userId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`vista:checkout:${userId}`}))`;
    },

    findByCheckoutKey(userId, checkoutKey) {
      return tx.order.findFirst({
        where: { userId, checkoutKey },
        include: ORDER_INCLUDE,
      });
    },

    findAddress(userId, addressId) {
      return tx.address.findFirst({
        where: { id: addressId, userId },
        select: {
          id: true,
          fullName: true,
          phone: true,
          province: true,
          city: true,
          postalCode: true,
          addressLine: true,
        },
      });
    },

    loadCartLines(userId) {
      return queryCartLines(tx, userId);
    },

    async decrementStock(variantId, quantity) {
      // یک UPDATE واحد با شرط در WHERE: Postgres ردیف را قفل می‌کند و شرط را بعد از قفل دوباره
      // می‌سنجد؛ پس دو خریدار همزمانِ آخرین واحد هرگز هر دو موفق نمی‌شوند و stock منفی نمی‌شود
      // (CHECK stock >= 0 هم آخرین خط دفاعی است).
      const rows = await tx.$queryRaw<{ stock: number }[]>`
        UPDATE "product_variants"
        SET "stock" = "stock" - ${quantity}, "version" = "version" + 1
        WHERE "id" = ${variantId} AND "stock" >= ${quantity}
        RETURNING "stock"`;
      return rows[0]?.stock ?? null;
    },

    async incrementStock(variantId, quantity) {
      const rows = await tx.$queryRaw<{ stock: number }[]>`
        UPDATE "product_variants"
        SET "stock" = "stock" + ${quantity}, "version" = "version" + 1
        WHERE "id" = ${variantId}
        RETURNING "stock"`;
      const row = rows[0];
      if (!row) throw new Error(`variant ${variantId} not found while restoring stock`);
      return row.stock;
    },

    async createOrder(data) {
      try {
        return await tx.order.create({
          data: {
            userId: data.userId,
            checkoutKey: data.checkoutKey,
            subtotal: data.subtotal,
            shippingCost: data.shippingCost,
            discountAmount: data.discountAmount,
            totalAmount: data.totalAmount,
            couponId: data.couponId,
            couponCode: data.couponCode,
            shippingFullName: data.address.fullName,
            shippingPhone: data.address.phone,
            shippingProvince: data.address.province,
            shippingCity: data.address.city,
            shippingPostalCode: data.address.postalCode,
            shippingAddressLine: data.address.addressLine,
            sellerOrders: {
              create: data.sellerOrders.map((so) => ({
                sellerId: so.sellerId,
                subtotal: so.subtotal,
                discountAmount: so.discountAmount,
                items: { create: so.items },
              })),
            },
          },
          include: ORDER_INCLUDE,
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new DuplicateCheckoutKeyError();
        throw error;
      }
    },

    async recordMovements(rows) {
      if (rows.length === 0) return;
      await tx.inventoryMovement.createMany({ data: rows });
    },

    async clearCart(userId) {
      await tx.cartItem.deleteMany({ where: { cart: { userId } } });
    },

    async lockOwnedOrder(userId, orderId) {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "orders" WHERE "id" = ${orderId} AND "userId" = ${userId} FOR UPDATE`;
      if (locked.length === 0) return null;
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          sellerOrders: {
            select: {
              status: true,
              items: { orderBy: { variantId: "asc" }, select: { variantId: true, quantity: true } },
            },
          },
        },
      });
      return {
        id: order.id,
        status: order.status,
        sellerOrderStatuses: order.sellerOrders.map((so) => so.status),
        items: order.sellerOrders.flatMap((so) => so.items),
      };
    },

    async markOrderCancelled(orderId) {
      // فقط شرط‌های اسکالر (بدون فیلتر رابطه‌ای) تا UPDATE واقعاً یک عبارت اتمیک باشد
      const result = await tx.order.updateMany({
        where: { id: orderId, status: "PENDING" },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      return result.count === 1;
    },

    async cancelPendingSellerOrders(orderId) {
      const result = await tx.sellerOrder.updateMany({
        where: { orderId, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      return result.count;
    },

    findOwnedById(userId, orderId) {
      return tx.order.findFirst({ where: { id: orderId, userId }, include: ORDER_INCLUDE });
    },

    findCouponByCode(code) {
      return findCouponRulesByCode(tx, code);
    },

    countActiveRedemptions(couponId, userId) {
      return countActiveRedemptions(tx, couponId, userId);
    },

    loadCategoryParents() {
      return loadCategoryParents(tx);
    },

    async tryConsumeCoupon(couponId) {
      // یک UPDATE واحد با شرط در WHERE (مثل decrementStock): Postgres ردیف را قفل می‌کند و شرط را بعد از
      // قفل دوباره می‌سنجد. CHECK usedCount <= usageLimit آخرین خط دفاعی است.
      const rows = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "coupons"
        SET "usedCount" = "usedCount" + 1, "updatedAt" = NOW()
        WHERE "id" = ${couponId}
          AND "isActive" = true
          AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")
        RETURNING "id"`;
      return rows.length === 1;
    },

    async createRedemption(input) {
      await tx.couponRedemption.create({ data: input });
    },

    async releaseCouponRedemption(orderId) {
      const released = await tx.couponRedemption.updateMany({
        where: { orderId, status: "ACTIVE" },
        data: { status: "RELEASED", releasedAt: new Date() },
      });
      if (released.count !== 1) return false;
      const redemption = await tx.couponRedemption.findUniqueOrThrow({
        where: { orderId },
        select: { couponId: true },
      });
      await tx.$executeRaw`
        UPDATE "coupons"
        SET "usedCount" = GREATEST("usedCount" - 1, 0), "updatedAt" = NOW()
        WHERE "id" = ${redemption.couponId}`;
      return true;
    },
  };
}

export function createOrdersRepository(prisma: PrismaClient): OrdersRepository {
  return {
    transaction(work) {
      return prisma.$transaction((tx) => work(createTx(tx)), { timeout: 15_000, maxWait: 10_000 });
    },

    findByCheckoutKey(userId, checkoutKey) {
      return prisma.order.findFirst({ where: { userId, checkoutKey }, include: ORDER_INCLUDE });
    },

    async markPaid(orderId, providerRef) {
      const result = await prisma.order.updateMany({
        where: { id: orderId, status: "PENDING" },
        data: { status: "PAID", paidAt: new Date(), paymentRef: providerRef },
      });
      return result.count === 1;
    },

    findById(orderId) {
      return prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    },

    async findManyForUser(userId, { page, limit, status }) {
      const where: Prisma.OrderWhereInput = {
        userId,
        ...(status ? { status: status as OrderStatus } : {}),
      };
      const [items, total] = await Promise.all([
        prisma.order.findMany({
          where,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
            ...LIST_INCLUDE,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.order.count({ where }),
      ]);
      return { items, total };
    },

    findOwnedById(userId, orderId) {
      return prisma.order.findFirst({ where: { id: orderId, userId }, include: ORDER_INCLUDE });
    },
  };
}
