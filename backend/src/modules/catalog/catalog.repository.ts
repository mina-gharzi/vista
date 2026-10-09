import type { Prisma, PrismaClient } from "@prisma/client";
import type { CatalogQuery } from "@vista/shared";

export interface ProductCardRow {
  id: string;
  slug: string;
  title: string;
  basePrice: number;
  compareAtPrice: number | null;
  category: { name: string };
  images: { url: string }[];
}

export interface ProductDetailRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  basePrice: number;
  compareAtPrice: number | null;
  images: { url: string; altText: string | null }[];
  variants: { id: string; size: string; color: string; price: number | null; stock: number }[];
  category: { id: string; name: string; slug: string };
  seller: { storeName: string };
}

const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  basePrice: true,
  compareAtPrice: true,
  category: { select: { name: true } },
  images: { take: 1, orderBy: { position: "asc" as const }, select: { url: true } },
} satisfies Prisma.ProductSelect;

export interface CatalogRepository {
  /** id همه دسته‌های فعال زیرمجموعه slug داده‌شده (شامل خودش)؛ اگر slug ناموجود/غیرفعال بود null */
  resolveCategorySubtreeIds(slug: string): Promise<string[] | null>;
  findMany(
    query: CatalogQuery,
    categoryIds: string[] | undefined,
  ): Promise<{ items: ProductCardRow[]; total: number }>;
  findPublishedBySlug(slug: string): Promise<ProductDetailRow | null>;
}

export function createCatalogRepository(prisma: PrismaClient): CatalogRepository {
  return {
    async resolveCategorySubtreeIds(slug) {
      const root = await prisma.category.findFirst({
        where: { slug, isActive: true },
        select: { id: true },
      });
      if (!root) return null;

      // همه دسته‌های فعال یک‌بار واکشی و با BFS از ریشه پایین می‌رویم؛ عمق درخت کم است (بخش ۳۰ پرامپت مادر)
      const all = await prisma.category.findMany({
        where: { isActive: true },
        select: { id: true, parentId: true },
      });
      const childrenOf = new Map<string, string[]>();
      for (const row of all) {
        if (!row.parentId) continue;
        const list = childrenOf.get(row.parentId) ?? [];
        list.push(row.id);
        childrenOf.set(row.parentId, list);
      }

      const ids: string[] = [];
      const queue = [root.id];
      while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined) break;
        ids.push(current);
        queue.push(...(childrenOf.get(current) ?? []));
      }
      return ids;
    },

    async findMany(query, categoryIds) {
      const where: Prisma.ProductWhereInput = {
        status: "PUBLISHED",
        ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
        ...(query.search ? { title: { contains: query.search, mode: "insensitive" } } : {}),
        ...(query.minPrice !== undefined ? { basePrice: { gte: query.minPrice } } : {}),
        ...(query.maxPrice !== undefined ? { basePrice: { lte: query.maxPrice } } : {}),
        ...(query.sort === "discounted" ? { compareAtPrice: { not: null } } : {}),
      };

      const orderBy: Prisma.ProductOrderByWithRelationInput =
        query.sort === "price_asc"
          ? { basePrice: "asc" }
          : query.sort === "price_desc"
            ? { basePrice: "desc" }
            : { createdAt: "desc" }; // newest و discounted هر دو تازه‌ترین‌ها اول

      const [items, total] = await Promise.all([
        prisma.product.findMany({
          where,
          select: CARD_SELECT,
          orderBy,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        prisma.product.count({ where }),
      ]);

      return { items, total };
    },

    async findPublishedBySlug(slug) {
      return prisma.product.findFirst({
        where: { slug, status: "PUBLISHED" },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          basePrice: true,
          compareAtPrice: true,
          images: { orderBy: { position: "asc" }, select: { url: true, altText: true } },
          variants: {
            where: { isActive: true },
            select: { id: true, size: true, color: true, price: true, stock: true },
          },
          category: { select: { id: true, name: true, slug: true } },
          seller: { select: { storeName: true } },
        },
      });
    },
  };
}
