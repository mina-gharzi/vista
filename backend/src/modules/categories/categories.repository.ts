import type { PrismaClient } from "@prisma/client";

/** ردیف خام Category که Repository از Database می‌خواند (بدون children — درخت در Service ساخته می‌شود) */
export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  parentId: string | null;
}

export interface CategoriesRepository {
  /** همه دسته‌های فعال، مرتب برای ساخت درخت (sortOrder سپس name) */
  findAllActive(): Promise<CategoryRow[]>;
  /** یک دسته با slug (صرف‌نظر از isActive — تشخیص «غیرفعال» با «ناموجود» به عهده Service است) */
  findBySlug(slug: string): Promise<(CategoryRow & { isActive: boolean }) | null>;
  /** والدهای یک دسته از نزدیک به دور (برای ساخت Breadcrumb) */
  findAncestors(categoryId: string): Promise<CategoryRow[]>;
}

const baseSelect = {
  id: true,
  name: true,
  slug: true,
  imageUrl: true,
  parentId: true,
} as const;

export function createCategoriesRepository(prisma: PrismaClient): CategoriesRepository {
  return {
    findAllActive() {
      return prisma.category.findMany({
        where: { isActive: true },
        select: baseSelect,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    },

    findBySlug(slug) {
      return prisma.category.findUnique({
        where: { slug },
        select: { ...baseSelect, isActive: true },
      });
    },

    async findAncestors(categoryId) {
      // عمق دسته‌بندی‌های Fashion معمولاً کم است (۲ تا ۳ سطح)؛ واکشی حلقه‌ای ساده
      // به‌جای Recursive CTE، هم ساده‌تر است و هم برای این عمق هزینه‌ای ندارد.
      const chain: CategoryRow[] = [];
      const current = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { ...baseSelect, isActive: true },
      });

      // خودِ دسته را کنار می‌گذاریم؛ فقط زنجیره والدها لازم است
      let parentId = current?.parentId ?? null;

      while (parentId) {
        const parent = await prisma.category.findUnique({
          where: { id: parentId },
          select: baseSelect,
        });
        if (!parent) break;
        chain.push(parent);
        parentId = parent.parentId;
      }

      return chain;
    },
  };
}
