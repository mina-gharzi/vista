import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { toAuditCreateData, type AuditInput } from "./admin.audit";

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  parentId: string | null;
}

export interface AdminCategoryRow extends CategoryRecord {
  parentName: string | null;
  productCount: number;
  childCount: number;
}

export interface CategoryCounts {
  products: number;
  publishedProducts: number;
  children: number;
  activeChildren: number;
}

export interface CategoryWriteData {
  name: string;
  slug: string;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  parentId: string | null;
}

/** نقض یکتایی slug در دیتابیس (آخرین خط دفاع در برابر Race) */
export class DuplicateCategorySlugError extends Error {}
/** FK دیتابیس مانع حذف شد (محصول/زیردسته‌ای همزمان اضافه شده) */
export class CategoryInUseError extends Error {}

export interface AdminCategoriesTx {
  /** تغییرات «درخت» (والد/حذف) پشت‌سرهم اجرا می‌شود تا دو جابه‌جایی همزمان حلقه نسازند */
  lockTree(): Promise<void>;
  findById(id: string): Promise<CategoryRecord | null>;
  findWithCounts(id: string): Promise<AdminCategoryRow | null>;
  slugTaken(slug: string, exceptId?: string): Promise<boolean>;
  /** زنجیرهٔ والدها از نزدیک به دور (خودِ دسته شامل نیست) */
  ancestorIds(id: string): Promise<string[]>;
  create(data: CategoryWriteData): Promise<CategoryRecord>;
  update(id: string, patch: Partial<CategoryWriteData>): Promise<CategoryRecord>;
  counts(id: string): Promise<CategoryCounts>;
  remove(id: string): Promise<void>;
  audit(input: AuditInput): Promise<void>;
}

export interface AdminCategoriesRepository {
  transaction<T>(work: (tx: AdminCategoriesTx) => Promise<T>): Promise<T>;
  listAll(): Promise<AdminCategoryRow[]>;
}

const RECORD_SELECT = {
  id: true,
  name: true,
  slug: true,
  imageUrl: true,
  isActive: true,
  sortOrder: true,
  parentId: true,
} satisfies Prisma.CategorySelect;

const ROW_SELECT = {
  ...RECORD_SELECT,
  parent: { select: { name: true } },
  _count: { select: { products: true, children: true } },
} satisfies Prisma.CategorySelect;

type RowRecord = Prisma.CategoryGetPayload<{ select: typeof ROW_SELECT }>;

function toRow(row: RowRecord): AdminCategoryRow {
  const { parent, _count, ...rest } = row;
  return { ...rest, parentName: parent?.name ?? null, productCount: _count.products, childCount: _count.children };
}

function createTx(tx: Prisma.TransactionClient): AdminCategoriesTx {
  return {
    async lockTree() {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('vista:admin:category-tree'))`;
    },
    findById: (id) => tx.category.findUnique({ where: { id }, select: RECORD_SELECT }),
    async findWithCounts(id) {
      const row = await tx.category.findUnique({ where: { id }, select: ROW_SELECT });
      return row ? toRow(row) : null;
    },
    async slugTaken(slug, exceptId) {
      const found = await tx.category.findFirst({
        where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
        select: { id: true },
      });
      return found !== null;
    },
    async ancestorIds(id) {
      const chain: string[] = [];
      let current = (await tx.category.findUnique({ where: { id }, select: { parentId: true } }))?.parentId ?? null;
      // سقف تکرار: حتی اگر داده‌ٔ قدیمی حلقه داشته باشد، حلقهٔ بی‌نهایت نداریم
      for (let guard = 0; current && guard < 100; guard += 1) {
        chain.push(current);
        current = (await tx.category.findUnique({ where: { id: current }, select: { parentId: true } }))?.parentId ?? null;
      }
      return chain;
    },
    async create(data) {
      try {
        return await tx.category.create({ data, select: RECORD_SELECT });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new DuplicateCategorySlugError();
        }
        throw error;
      }
    },
    async update(id, patch) {
      try {
        return await tx.category.update({ where: { id }, data: patch, select: RECORD_SELECT });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new DuplicateCategorySlugError();
        }
        throw error;
      }
    },
    async counts(id) {
      const [products, publishedProducts, children, activeChildren] = await Promise.all([
        tx.product.count({ where: { categoryId: id } }),
        tx.product.count({ where: { categoryId: id, status: "PUBLISHED" } }),
        tx.category.count({ where: { parentId: id } }),
        tx.category.count({ where: { parentId: id, isActive: true } }),
      ]);
      return { products, publishedProducts, children, activeChildren };
    },
    async remove(id) {
      try {
        await tx.category.delete({ where: { id } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
          throw new CategoryInUseError();
        }
        throw error;
      }
    },
    async audit(input) {
      await tx.adminAuditLog.create({ data: toAuditCreateData(input) });
    },
  };
}

export function createAdminCategoriesRepository(prisma: PrismaClient): AdminCategoriesRepository {
  return {
    transaction: (work) => prisma.$transaction((tx) => work(createTx(tx)), { timeout: 15_000 }),
    async listAll() {
      const rows = await prisma.category.findMany({
        select: ROW_SELECT,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      return rows.map(toRow);
    },
  };
}
