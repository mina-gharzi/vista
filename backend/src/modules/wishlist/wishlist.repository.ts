import type { PrismaClient } from "@prisma/client";

export interface WishlistItemRow {
  productId: string;
  createdAt: Date;
  product: {
    slug: string;
    title: string;
    basePrice: number;
    compareAtPrice: number | null;
    status: string;
    category: { name: string };
    images: { url: string }[];
  };
}

export interface WishlistRepository {
  findAllForUser(userId: string): Promise<WishlistItemRow[]>;
  isWishlisted(userId: string, productId: string): Promise<boolean>;
  productExists(productId: string): Promise<boolean>;
  /** بدون خطا اگر از قبل وجود داشته باشد (Idempotent) */
  add(userId: string, productId: string): Promise<void>;
  remove(userId: string, productId: string): Promise<void>;
}

const ITEM_SELECT = {
  productId: true,
  createdAt: true,
  product: {
    select: {
      slug: true,
      title: true,
      basePrice: true,
      compareAtPrice: true,
      status: true,
      category: { select: { name: true } },
      images: { take: 1, orderBy: { position: "asc" as const }, select: { url: true } },
    },
  },
} as const;

export function createWishlistRepository(prisma: PrismaClient): WishlistRepository {
  return {
    async findAllForUser(userId) {
      const wishlist = await prisma.wishlist.findUnique({
        where: { userId },
        select: { items: { select: ITEM_SELECT, orderBy: { createdAt: "desc" } } },
      });
      return wishlist?.items ?? [];
    },

    async isWishlisted(userId, productId) {
      const item = await prisma.wishlistItem.findFirst({
        where: { productId, wishlist: { userId } },
        select: { productId: true },
      });
      return item !== null;
    },

    async productExists(productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });
      return product !== null;
    },

    async add(userId, productId) {
      const wishlist = await prisma.wishlist.upsert({
        where: { userId },
        update: {},
        create: { userId },
        select: { id: true },
      });

      const existing = await prisma.wishlistItem.findUnique({
        where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
        select: { productId: true },
      });
      if (existing) return; // Idempotent — قبلاً اضافه شده

      await prisma.wishlistItem.create({ data: { wishlistId: wishlist.id, productId } });
    },

    async remove(userId, productId) {
      await prisma.wishlistItem.deleteMany({ where: { productId, wishlist: { userId } } });
    },
  };
}
