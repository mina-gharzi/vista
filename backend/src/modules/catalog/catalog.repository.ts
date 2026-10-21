import type { Prisma, PrismaClient } from "@prisma/client";
import type { CatalogFilterOptions, CatalogQuery } from "@vista/shared";
import { buildCatalogWhere, buildOrderBy, visibleProductWhere, searchConditions } from "./catalog.query";

export interface ProductCardRow {
  id: string;
  slug: string;
  title: string;
  basePrice: number;
  compareAtPrice: number | null;
  category: { name: string };
  images: { url: string }[];
  seller: { storeName: string; storeSlug: string };
  /** حداکثر یک ردیف: وجود هر تنوع فعالِ موجود */
  variants: { id: string }[];
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
  seller: { storeName: string; storeSlug: string };
}

const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  basePrice: true,
  compareAtPrice: true,
  category: { select: { name: true } },
  images: { take: 1, orderBy: { position: "asc" as const }, select: { url: true } },
  seller: { select: { storeName: true, storeSlug: true } },
  // فقط برای «موجود بودن»: یک ردیف کافی است و N+1 ایجاد نمی‌کند (join در همان Query)
  variants: { where: { isActive: true, stock: { gt: 0 } }, take: 1, select: { id: true } },
} satisfies Prisma.ProductSelect;

export interface CatalogRepository {
  /** id همه دسته‌های فعال زیرمجموعه slug داده‌شده (شامل خودش)؛ اگر slug ناموجود/غیرفعال بود null */
  resolveCategorySubtreeIds(slug: string): Promise<string[] | null>;
  findMany(
    query: CatalogQuery,
    categoryIds: string[] | undefined,
  ): Promise<{ items: ProductCardRow[]; total: number }>;
  findPublishedBySlug(slug: string): Promise<ProductDetailRow | null>;
  /** رنگ/سایز تنوع‌های فعال و بازهٔ قیمت در محدودهٔ دسته/جستجو */
  filterOptions(query: { search?: string | undefined }, categoryIds: string[] | undefined): Promise<CatalogFilterOptions>;
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
      const where = buildCatalogWhere(query, categoryIds);
      const orderBy = buildOrderBy(query.sort);

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

    async filterOptions(query, categoryIds) {
      // محدودهٔ محصولات: فقط دسته + جستجو (سایر فیلترها عمداً اعمال نمی‌شود تا گزینه‌ها با انتخاب خودشان محو نشوند)
      const productWhere: Prisma.ProductWhereInput = {
        ...visibleProductWhere(),
        ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
        AND: searchConditions(query.search),
      };
      const variantWhere = { isActive: true, product: productWhere } satisfies Prisma.ProductVariantWhereInput;
      const [colors, sizes, price] = await Promise.all([
        prisma.productVariant.findMany({ where: variantWhere, distinct: ["color"], select: { color: true }, orderBy: { color: "asc" }, take: 60 }),
        prisma.productVariant.findMany({ where: variantWhere, distinct: ["size"], select: { size: true }, take: 60 }),
        prisma.product.aggregate({ where: productWhere, _min: { basePrice: true }, _max: { basePrice: true } }),
      ]);
      const min = price._min.basePrice;
      const max = price._max.basePrice;
      return {
        colors: colors.map((c) => c.color),
        sizes: sizes.map((s) => s.size),
        priceRange: min === null || max === null ? null : { min, max },
      };
    },

    async findPublishedBySlug(slug) {
      return prisma.product.findFirst({
        where: { slug, status: "PUBLISHED", seller: { status: "APPROVED" } },
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
          seller: { select: { storeName: true, storeSlug: true } },
        },
      });
    },
  };
}
