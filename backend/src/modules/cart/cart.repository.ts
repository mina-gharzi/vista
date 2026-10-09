import type { Prisma, PrismaClient } from "@prisma/client";

export interface CartItemRow {
  quantity: number;
  variant: {
    id: string;
    size: string;
    color: string;
    price: number | null;
    stock: number;
    product: {
      id: string;
      slug: string;
      title: string;
      basePrice: number;
      status: string;
      images: { url: string }[];
    };
  };
}

export interface VariantForCart {
  id: string;
  stock: number;
  /** تنوع آرشیوشده قابل خرید نیست */
  isActive?: boolean;
  product: { status: string };
}

const CART_ITEMS_SELECT = {
  quantity: true,
  variant: {
    select: {
      id: true,
      size: true,
      color: true,
      price: true,
      stock: true,
      product: {
        select: {
          id: true,
          slug: true,
          title: true,
          basePrice: true,
          status: true,
          images: { take: 1, orderBy: { position: "asc" as const }, select: { url: true } },
        },
      },
    },
  },
} satisfies Prisma.CartItemSelect;

export interface CartRepository {
  findVariantForCart(variantId: string): Promise<VariantForCart | null>;
  getItems(userId: string): Promise<CartItemRow[]>;
  /** تعداد فعلی همین Variant در سبد کاربر (برای اعتبارسنجی موجودی هنگام افزودن) */
  getItemQuantity(userId: string, variantId: string): Promise<number>;
  /** ساخت سبد در صورت نبود + Upsert مقدار جدید Item (Set، نه Increment — مقدار نهایی از Service محاسبه می‌شود) */
  upsertItem(userId: string, variantId: string, quantity: number): Promise<void>;
  removeItem(userId: string, variantId: string): Promise<void>;
}

export function createCartRepository(prisma: PrismaClient): CartRepository {
  return {
    async findVariantForCart(variantId) {
      return prisma.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, stock: true, isActive: true, product: { select: { status: true } } },
      });
    },

    async getItems(userId) {
      const cart = await prisma.cart.findUnique({
        where: { userId },
        select: { items: { select: CART_ITEMS_SELECT } },
      });
      return cart?.items ?? [];
    },

    async getItemQuantity(userId, variantId) {
      const item = await prisma.cartItem.findFirst({
        where: { variantId, cart: { userId } },
        select: { quantity: true },
      });
      return item?.quantity ?? 0;
    },

    async upsertItem(userId, variantId, quantity) {
      const cart = await prisma.cart.upsert({
        where: { userId },
        update: {},
        create: { userId },
        select: { id: true },
      });

      await prisma.cartItem.upsert({
        where: { cartId_variantId: { cartId: cart.id, variantId } },
        update: { quantity },
        create: { cartId: cart.id, variantId, quantity },
      });
    },

    async removeItem(userId, variantId) {
      // idempotent: اگر Item یا حتی خودِ Cart وجود نداشته باشد، deleteMany بی‌خطا صفر ردیف حذف می‌کند
      await prisma.cartItem.deleteMany({ where: { variantId, cart: { userId } } });
    },
  };
}
