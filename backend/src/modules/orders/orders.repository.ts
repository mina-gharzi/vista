import type { Prisma, PrismaClient } from "@prisma/client";

export interface CartItemForCheckout {
  variantId: string;
  quantity: number;
}

export interface OrderWithRelations {
  id: string;
  orderNumber: number;
  status: string;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  totalAmount: number;
  shippingFullName: string;
  shippingPhone: string;
  shippingProvince: string;
  shippingCity: string;
  shippingPostalCode: string;
  shippingAddressLine: string;
  createdAt: Date;
  paidAt: Date | null;
  sellerOrders: {
    id: string;
    status: string;
    subtotal: number;
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

/** خطای داخلی (نه AppError) — Service آن را به NotFoundError واقعی تبدیل می‌کند. */
export class AddressNotOwnedError extends Error {}

/** خطای داخلی (نه AppError) — Service آن را به ConflictError واقعی تبدیل می‌کند. */
export class EmptyCartError extends Error {}

export interface UnavailableItem {
  variantId: string;
  productTitle: string;
  reason: "NOT_PUBLISHED" | "INSUFFICIENT_STOCK";
  availableStock: number;
}

/** خطای داخلی (نه AppError) — شامل همه آیتم‌های مشکل‌دار (نه فقط اولی)، Service آن را ConflictError می‌کند. */
export class ItemsUnavailableError extends Error {
  constructor(public readonly items: UnavailableItem[]) {
    super("items unavailable");
  }
}

const ORDER_INCLUDE = {
  sellerOrders: {
    include: {
      seller: { select: { storeName: true } },
      items: { include: { variant: { select: { product: { select: { slug: true } } } } } },
    },
  },
} satisfies Prisma.OrderInclude;

export interface OrdersRepository {
  /**
   * کل فرآیند ثبت سفارش در یک Transaction: بررسی آدرس، بررسی PUBLISHED بودن و موجودی هر کالا
   * (با Update شرطی روی stock — منبع حقیقت موجودی همیشه Database است)، ایجاد Order/SellerOrder/OrderItem،
   * ثبت InventoryMovement، و خالی‌کردن سبد. اگر هر مرحله شکست بخورد کل Transaction Rollback می‌شود.
   */
  createOrderFromCart(userId: string, addressId: string): Promise<OrderWithRelations>;
  markPaid(orderId: string, providerRef: string): Promise<OrderWithRelations>;
  findManyForUser(
    userId: string,
    params: { page: number; limit: number },
  ): Promise<{ items: OrderWithRelations[]; total: number }>;
  findOwnedById(userId: string, orderId: string): Promise<OrderWithRelations | null>;
}

export function createOrdersRepository(prisma: PrismaClient): OrdersRepository {
  return {
    async createOrderFromCart(userId, addressId) {
      return prisma.$transaction(async (tx) => {
        const address = await tx.address.findFirst({ where: { id: addressId, userId } });
        if (!address) throw new AddressNotOwnedError();

        const cart = await tx.cart.findUnique({
          where: { userId },
          select: {
            items: {
              select: {
                variantId: true,
                quantity: true,
                variant: {
                  select: {
                    id: true,
                    size: true,
                    color: true,
                    sku: true,
                    price: true,
                    stock: true,
                    product: {
                      select: {
                        id: true,
                        sellerId: true,
                        slug: true,
                        title: true,
                        basePrice: true,
                        status: true,
                        images: { take: 1, orderBy: { position: "asc" }, select: { url: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        });
        const cartItems = cart?.items ?? [];
        if (cartItems.length === 0) {
          throw new EmptyCartError();
        }

        // موجودی/انتشار هر کالا همین‌جا (داخل Transaction) بررسی و کسر می‌شود — منبع حقیقت Database است،
        // نه چیزی که قبل از شروع Checkout در سبد دیده شده بود.
        interface PricedItem {
          variantId: string;
          sellerId: string;
          productSlug: string;
          productTitle: string;
          sku: string;
          size: string;
          color: string;
          imageUrl: string | null;
          quantity: number;
          unitPrice: number;
          stockAfter: number;
        }

        // گذر اول (فقط خواندن): هر مشکلی (منتشرنشده/موجودی ناکافی) را جمع می‌کنیم تا کاربر همه را
        // یک‌جا ببیند، نه اینکه با هر بار تلاش فقط از یک مورد مطلع شود.
        const problems: {
          variantId: string;
          productTitle: string;
          reason: "NOT_PUBLISHED" | "INSUFFICIENT_STOCK";
          availableStock: number;
        }[] = [];
        for (const item of cartItems) {
          if (item.variant.product.status !== "PUBLISHED") {
            problems.push({
              variantId: item.variantId,
              productTitle: item.variant.product.title,
              reason: "NOT_PUBLISHED",
              availableStock: 0,
            });
          } else if (item.variant.stock < item.quantity) {
            problems.push({
              variantId: item.variantId,
              productTitle: item.variant.product.title,
              reason: "INSUFFICIENT_STOCK",
              availableStock: item.variant.stock,
            });
          }
        }
        if (problems.length > 0) {
          throw new ItemsUnavailableError(problems);
        }

        // گذر دوم: کسر واقعی. شرط stock >= quantity در همین Query دوباره تکرار می‌شود چون بین گذر اول
        // و این‌جا یک Query دیگر فاصله است؛ Update شرطی خودش آخرین خط دفاعی در برابر Race Condition است.
        const pricedItems: PricedItem[] = [];
        for (const item of cartItems) {
          const decremented = await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (decremented.count !== 1) {
            const fresh = await tx.productVariant.findUnique({
              where: { id: item.variantId },
              select: { stock: true },
            });
            throw new ItemsUnavailableError([
              {
                variantId: item.variantId,
                productTitle: item.variant.product.title,
                reason: "INSUFFICIENT_STOCK",
                availableStock: fresh?.stock ?? 0,
              },
            ]);
          }

          // updateMany مقدار جدید را برنمی‌گرداند؛ بلافاصله بعد از کسر موفق می‌خوانیم (برای InventoryMovement)
          const afterDecrement = await tx.productVariant.findUniqueOrThrow({
            where: { id: item.variantId },
            select: { stock: true },
          });

          pricedItems.push({
            variantId: item.variantId,
            sellerId: item.variant.product.sellerId,
            productSlug: item.variant.product.slug,
            productTitle: item.variant.product.title,
            sku: item.variant.sku,
            size: item.variant.size,
            color: item.variant.color,
            imageUrl: item.variant.product.images[0]?.url ?? null,
            quantity: item.quantity,
            unitPrice: item.variant.price ?? item.variant.product.basePrice,
            stockAfter: afterDecrement.stock,
          });
        }

        const subtotal = pricedItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
        // Shipping و Discount در Phase 4 (Shipping/Coupons) اضافه می‌شوند؛ فعلاً صفر است
        const shippingCost = 0;
        const discountAmount = 0;

        const bySeller = new Map<string, PricedItem[]>();
        for (const item of pricedItems) {
          const list = bySeller.get(item.sellerId) ?? [];
          list.push(item);
          bySeller.set(item.sellerId, list);
        }

        const order = await tx.order.create({
          data: {
            userId,
            subtotal,
            shippingCost,
            discountAmount,
            totalAmount: subtotal + shippingCost - discountAmount,
            shippingFullName: address.fullName,
            shippingPhone: address.phone,
            shippingProvince: address.province,
            shippingCity: address.city,
            shippingPostalCode: address.postalCode,
            shippingAddressLine: address.addressLine,
            sellerOrders: {
              create: [...bySeller.entries()].map(([sellerId, items]) => ({
                sellerId,
                subtotal: items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
                items: {
                  create: items.map((i) => ({
                    variantId: i.variantId,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    productTitle: i.productTitle,
                    sku: i.sku,
                    size: i.size,
                    color: i.color,
                    imageUrl: i.imageUrl,
                  })),
                },
              })),
            },
          },
          include: ORDER_INCLUDE,
        });

        if (pricedItems.length > 0) {
          await tx.inventoryMovement.createMany({
            data: pricedItems.map((i) => ({
              variantId: i.variantId,
              type: "ORDER_PLACED",
              quantityDelta: -i.quantity,
              stockAfter: i.stockAfter,
              actorId: userId,
              orderId: order.id,
            })),
          });
        }

        await tx.cartItem.deleteMany({ where: { cart: { userId } } });

        return order;
      });
    },

    async markPaid(orderId, providerRef) {
      return prisma.order.update({
        where: { id: orderId },
        data: { status: "PAID", paidAt: new Date(), paymentRef: providerRef },
        include: ORDER_INCLUDE,
      });
    },

    async findManyForUser(userId, { page, limit }) {
      const where: Prisma.OrderWhereInput = { userId };
      const [items, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: ORDER_INCLUDE,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.order.count({ where }),
      ]);
      return { items, total };
    },

    async findOwnedById(userId, orderId) {
      return prisma.order.findFirst({ where: { id: orderId, userId }, include: ORDER_INCLUDE });
    },
  };
}
