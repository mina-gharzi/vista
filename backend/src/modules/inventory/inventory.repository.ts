import type { Prisma, PrismaClient } from "@prisma/client";
import {
  MAX_VARIANT_STOCK,
  type InventoryMovementType,
  type StockStatus,
} from "@vista/shared";
import { ConflictError, ValidationError } from "../../errors/AppError";

/**
 * منبع حقیقت موجودی: ProductVariant.stock. InventoryMovement فقط دفتر کل همان تغییرات است
 * (previousQuantity ذخیره نمی‌شود چون همیشه stockAfter − quantityDelta است؛ ستون تکراری = منبع دوم).
 */

export interface InventoryVariantRow {
  variantId: string;
  productId: string;
  productTitle: string;
  productStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  size: string;
  color: string;
  sku: string;
  stock: number;
  isActive: boolean;
  lastMovementAt: Date | null;
}

export interface MovementRow {
  id: string;
  type: InventoryMovementType;
  quantityDelta: number;
  stockAfter: number;
  reason: string | null;
  /** نام کاربر ثبت‌کننده؛ لایه Service برای حرکت‌های سفارش (مشتری) آن را حذف می‌کند */
  actorName: string | null;
  orderId: string | null;
  createdAt: Date;
}

export type StockChange =
  | { kind: "DELTA"; delta: number }
  | { kind: "SET"; quantity: number };

export interface StockChangeMeta {
  type: Extract<InventoryMovementType, "RESTOCK" | "ADJUSTMENT">;
  reason: string;
  /** از توکن احراز هویت (هرگز از Body) */
  actorId: string;
}

export interface StockChangeResult {
  variant: InventoryVariantRow;
  movement: MovementRow;
}

export interface InventoryListParams {
  page: number;
  limit: number;
  status?: StockStatus | undefined;
  q?: string | undefined;
  lowStockThreshold: number;
}

export interface InventoryCounts {
  totalVariants: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalUnits: number;
}

export const NEGATIVE_STOCK_MESSAGE = "موجودی نمی‌تواند منفی شود";
export const NO_CHANGE_MESSAGE = "موجودی جدید با موجودی فعلی یکسان است";
export const STOCK_LIMIT_MESSAGE = "موجودی از سقف مجاز بیشتر می‌شود";
export const ARCHIVED_MESSAGE = "تنوع یا محصول آرشیوشده قابل تغییر موجودی نیست";

/**
 * قانون یکتای محاسبه موجودی بعدی؛ هم Repository واقعی و هم Fake تست از همین استفاده می‌کنند.
 * «current» باید مقدار «قفل‌شده» داخل Transaction باشد، نه مقدار خوانده‌شده در لحظه نمایش.
 */
export function resolveNextStock(current: number, change: StockChange): number {
  const next = change.kind === "DELTA" ? current + change.delta : change.quantity;
  if (next < 0) {
    throw new ConflictError(NEGATIVE_STOCK_MESSAGE, {
      delta: [`${NEGATIVE_STOCK_MESSAGE} (موجودی فعلی: ${current})`],
    });
  }
  if (next > MAX_VARIANT_STOCK) {
    throw new ConflictError(STOCK_LIMIT_MESSAGE, { quantity: [STOCK_LIMIT_MESSAGE] });
  }
  if (next === current) {
    throw new ValidationError(NO_CHANGE_MESSAGE, { newQuantity: [NO_CHANGE_MESSAGE] });
  }
  return next;
}

export interface InventoryRepository {
  findSellerByUserId(userId: string): Promise<{ id: string; status: string } | null>;
  list(
    sellerId: string,
    params: InventoryListParams,
  ): Promise<{ items: InventoryVariantRow[]; total: number }>;
  counts(sellerId: string, lowStockThreshold: number): Promise<InventoryCounts>;
  /** فقط اگر Variant متعلق به محصول همین فروشنده باشد */
  findOwnedVariant(sellerId: string, variantId: string): Promise<InventoryVariantRow | null>;
  listMovements(
    variantId: string,
    params: { page: number; limit: number },
  ): Promise<{ items: MovementRow[]; total: number }>;
  /**
   * قفل ردیف + محاسبه + به‌روزرسانی موجودی + ثبت InventoryMovement در «یک» Transaction.
   * مالکیت داخل همین Query قفل بررسی می‌شود. اگر Variant مال این فروشنده نباشد null برمی‌گردد.
   */
  applyStockChange(
    sellerId: string,
    variantId: string,
    change: StockChange,
    meta: StockChangeMeta,
  ): Promise<StockChangeResult | null>;
}

const ROW_SELECT = {
  id: true,
  productId: true,
  size: true,
  color: true,
  sku: true,
  stock: true,
  isActive: true,
  product: { select: { title: true, status: true } },
  inventoryMovements: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
} satisfies Prisma.ProductVariantSelect;

type VariantPayload = Prisma.ProductVariantGetPayload<{ select: typeof ROW_SELECT }>;

function toRow(v: VariantPayload): InventoryVariantRow {
  return {
    variantId: v.id,
    productId: v.productId,
    productTitle: v.product.title,
    productStatus: v.product.status,
    size: v.size,
    color: v.color,
    sku: v.sku,
    stock: v.stock,
    isActive: v.isActive,
    lastMovementAt: v.inventoryMovements[0]?.createdAt ?? null,
  };
}

const MOVEMENT_SELECT = {
  id: true,
  type: true,
  quantityDelta: true,
  stockAfter: true,
  reason: true,
  orderId: true,
  createdAt: true,
  actor: { select: { fullName: true } },
} satisfies Prisma.InventoryMovementSelect;

type MovementPayload = Prisma.InventoryMovementGetPayload<{ select: typeof MOVEMENT_SELECT }>;

function toMovementRow(m: MovementPayload): MovementRow {
  return {
    id: m.id,
    type: m.type,
    quantityDelta: m.quantityDelta,
    stockAfter: m.stockAfter,
    reason: m.reason,
    actorName: m.actor?.fullName ?? null,
    orderId: m.orderId,
    createdAt: m.createdAt,
  };
}

/** Variantهای فعالِ محصولات غیرآرشیو همین فروشنده؛ sellerId داخل خود شرط Query است */
function inventoryScope(sellerId: string): Prisma.ProductVariantWhereInput {
  return { isActive: true, product: { sellerId, status: { not: "ARCHIVED" } } };
}

function stockWhere(status: StockStatus, threshold: number): Prisma.ProductVariantWhereInput {
  switch (status) {
    case "OUT_OF_STOCK":
      return { stock: { lte: 0 } };
    case "LOW_STOCK":
      return { stock: { gt: 0, lte: threshold } };
    case "IN_STOCK":
      return { stock: { gt: threshold } };
  }
}

interface LockedRow {
  stock: number;
  isActive: boolean;
  productStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export function createInventoryRepository(prisma: PrismaClient): InventoryRepository {
  return {
    async findSellerByUserId(userId) {
      return prisma.seller.findUnique({ where: { userId }, select: { id: true, status: true } });
    },

    async list(sellerId, { page, limit, status, q, lowStockThreshold }) {
      const where: Prisma.ProductVariantWhereInput = {
        ...inventoryScope(sellerId),
        ...(status ? stockWhere(status, lowStockThreshold) : {}),
        ...(q
          ? {
              OR: [
                { sku: { contains: q, mode: "insensitive" as const } },
                { color: { contains: q, mode: "insensitive" as const } },
                { size: { contains: q, mode: "insensitive" as const } },
                { product: { title: { contains: q, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.productVariant.findMany({
          where,
          select: ROW_SELECT,
          orderBy: [{ product: { title: "asc" } }, { color: "asc" }, { size: "asc" }, { id: "asc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.productVariant.count({ where }),
      ]);
      return { items: rows.map(toRow), total };
    },

    async counts(sellerId, threshold) {
      const scope = inventoryScope(sellerId);
      const [totalVariants, inStockCount, lowStockCount, outOfStockCount, sum] = await Promise.all([
        prisma.productVariant.count({ where: scope }),
        prisma.productVariant.count({ where: { ...scope, ...stockWhere("IN_STOCK", threshold) } }),
        prisma.productVariant.count({ where: { ...scope, ...stockWhere("LOW_STOCK", threshold) } }),
        prisma.productVariant.count({ where: { ...scope, ...stockWhere("OUT_OF_STOCK", threshold) } }),
        prisma.productVariant.aggregate({ where: scope, _sum: { stock: true } }),
      ]);
      return {
        totalVariants,
        inStockCount,
        lowStockCount,
        outOfStockCount,
        totalUnits: sum._sum.stock ?? 0,
      };
    },

    async findOwnedVariant(sellerId, variantId) {
      // بدون فیلتر isActive/status: تاریخچه Variant آرشیوشده هم برای صاحبش قابل مشاهده است
      const row = await prisma.productVariant.findFirst({
        where: { id: variantId, product: { sellerId } },
        select: ROW_SELECT,
      });
      return row ? toRow(row) : null;
    },

    async listMovements(variantId, { page, limit }) {
      const [rows, total] = await Promise.all([
        prisma.inventoryMovement.findMany({
          where: { variantId },
          select: MOVEMENT_SELECT,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.inventoryMovement.count({ where: { variantId } }),
      ]);
      return { items: rows.map(toMovementRow), total };
    },

    async applyStockChange(sellerId, variantId, change, meta) {
      return prisma.$transaction(async (tx) => {
        // قفل ردیف (SELECT ... FOR UPDATE): تغییرهای همزمان همان Variant (از جمله Checkout که روی همین
        // ردیف UPDATE می‌زند) پشت این Transaction صف می‌شوند و مقدار «current» دیگر کهنه نمی‌شود.
        // مالکیت در همین Query است؛ ردیف فروشنده دیگر اصلاً قفل/خوانده نمی‌شود.
        const locked = await tx.$queryRaw<LockedRow[]>`
          SELECT v."stock" AS "stock", v."isActive" AS "isActive", p."status"::text AS "productStatus"
          FROM "product_variants" v
          JOIN "products" p ON p."id" = v."productId"
          WHERE v."id" = ${variantId} AND p."sellerId" = ${sellerId}
          FOR UPDATE OF v`;
        const current = locked[0];
        if (!current) return null;
        if (!current.isActive || current.productStatus === "ARCHIVED") {
          throw new ConflictError(ARCHIVED_MESSAGE);
        }

        const next = resolveNextStock(current.stock, change);

        await tx.productVariant.update({
          where: { id: variantId },
          data: { stock: next, version: { increment: 1 } },
          select: { id: true },
        });
        const movement = await tx.inventoryMovement.create({
          data: {
            variantId,
            type: meta.type,
            quantityDelta: next - current.stock,
            stockAfter: next,
            reason: meta.reason,
            actorId: meta.actorId,
          },
          select: MOVEMENT_SELECT,
        });
        const variant = await tx.productVariant.findUniqueOrThrow({
          where: { id: variantId },
          select: ROW_SELECT,
        });
        return { variant: toRow(variant), movement: toMovementRow(movement) };
      });
    },
  };
}
