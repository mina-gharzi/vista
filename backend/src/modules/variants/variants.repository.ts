import type { Prisma, PrismaClient } from "@prisma/client";
import { ConflictError } from "../../errors/AppError";

export interface VariantRow {
  id: string;
  productId: string;
  sku: string;
  size: string;
  color: string;
  price: number | null;
  stock: number;
  isActive: boolean;
}

export interface OwnedProductRow {
  id: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  basePrice: number;
}

export interface NewVariantData {
  size: string;
  color: string;
  sku: string;
  price: number | null;
  /** فقط موجودی اولیه؛ به‌صورت رکورد INITIAL در دفتر کل انبار ثبت می‌شود */
  stock: number;
}

export interface VariantPatch {
  size?: string | undefined;
  color?: string | undefined;
  sku?: string | undefined;
  price?: number | null | undefined;
  isActive?: boolean | undefined;
}

export const SKU_TAKEN_MESSAGE = "این SKU قبلاً استفاده شده است";
export const COMBINATION_TAKEN_MESSAGE = "این ترکیب رنگ و سایز برای این محصول قبلاً ثبت شده است";

export interface VariantsRepository {
  findSellerByUserId(userId: string): Promise<{ id: string; status: string } | null>;
  /** فقط اگر محصول متعلق به همین فروشنده باشد برمی‌گردد */
  findOwnedProduct(sellerId: string, productId: string): Promise<OwnedProductRow | null>;
  /** همه تنوع‌ها (فعال و آرشیو) در یک Query */
  listByProduct(productId: string): Promise<VariantRow[]>;
  skuExists(sku: string): Promise<boolean>;
  create(productId: string, data: NewVariantData, actorUserId: string): Promise<VariantRow>;
  update(variantId: string, patch: VariantPatch): Promise<VariantRow>;
  /** همه نوشتن‌های یک عملیات (مثلاً ذخیره Builder) را اتمیک می‌کند */
  transaction<T>(work: (repository: VariantsRepository) => Promise<T>): Promise<T>;
}

const SELECT = {
  id: true,
  productId: true,
  sku: true,
  size: true,
  color: true,
  price: true,
  stock: true,
  isActive: true,
} as const;

type Db = PrismaClient | Prisma.TransactionClient;

/** نقض Unique (Race بین بررسی و نوشتن) → 409 فیلد‌دار؛ target نشان می‌دهد SKU است یا ترکیب رنگ/سایز */
function rethrowUniqueConflict(error: unknown): never {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
    const target = JSON.stringify((error as { meta?: { target?: unknown } }).meta?.target ?? "");
    if (target.includes("sku")) {
      throw new ConflictError(SKU_TAKEN_MESSAGE, { sku: [SKU_TAKEN_MESSAGE] });
    }
    throw new ConflictError(COMBINATION_TAKEN_MESSAGE, { color: [COMBINATION_TAKEN_MESSAGE] });
  }
  throw error;
}

function build(db: Db, rootClient: PrismaClient | null): VariantsRepository {
  const self: VariantsRepository = {
    async findSellerByUserId(userId) {
      return db.seller.findUnique({ where: { userId }, select: { id: true, status: true } });
    },

    async findOwnedProduct(sellerId, productId) {
      // sellerId داخل خود شرط Query است: محصول فروشنده دیگر هرگز خوانده نمی‌شود
      return db.product.findFirst({
        where: { id: productId, sellerId },
        select: { id: true, status: true, basePrice: true },
      });
    },

    async listByProduct(productId) {
      return db.productVariant.findMany({
        where: { productId },
        select: SELECT,
        orderBy: [{ color: "asc" }, { size: "asc" }],
      });
    },

    async skuExists(sku) {
      return (await db.productVariant.findUnique({ where: { sku }, select: { id: true } })) !== null;
    },

    async create(productId, data, actorUserId) {
      try {
        const created = await db.productVariant.create({
          data: { productId, ...data },
          select: SELECT,
        });
        await db.inventoryMovement.create({
          data: {
            variantId: created.id,
            type: "INITIAL",
            quantityDelta: data.stock,
            stockAfter: data.stock,
            actorId: actorUserId,
          },
        });
        return created;
      } catch (error) {
        return rethrowUniqueConflict(error);
      }
    },

    async update(variantId, patch) {
      try {
        return await db.productVariant.update({
          where: { id: variantId },
          data: {
            ...(patch.size !== undefined ? { size: patch.size } : {}),
            ...(patch.color !== undefined ? { color: patch.color } : {}),
            ...(patch.sku !== undefined ? { sku: patch.sku } : {}),
            ...(patch.price !== undefined ? { price: patch.price } : {}),
            ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
          },
          select: SELECT,
        });
      } catch (error) {
        return rethrowUniqueConflict(error);
      }
    },

    async transaction(work) {
      if (!rootClient) return work(self); // از قبل داخل Transaction هستیم
      return rootClient.$transaction((tx) => work(build(tx, null)));
    },
  };
  return self;
}

export function createVariantsRepository(prisma: PrismaClient): VariantsRepository {
  return build(prisma, prisma);
}
