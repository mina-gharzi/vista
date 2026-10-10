import {
  LOW_STOCK_THRESHOLD,
  getStockStatus,
  type AdjustStockInput,
  type InventoryItem,
  type InventoryMovementEntry,
  type InventoryMovementsQuery,
  type InventoryMutationResult,
  type InventoryMovementsResult,
  type RestockInput,
  type SellerInventoryList,
  type SellerInventoryQuery,
} from "@vista/shared";
import { AuthorizationError, NotFoundError } from "../../errors/AppError";
import type {
  InventoryRepository,
  InventoryVariantRow,
  MovementRow,
  StockChange,
} from "./inventory.repository";

/** فقط تغییرهای دستیِ فروشنده/ادمین نام ثبت‌کننده دارند؛ برای سفارش‌ها ثبت‌کننده مشتری است و هرگز نمایش داده نمی‌شود */
const MANUAL_TYPES: ReadonlySet<string> = new Set(["INITIAL", "RESTOCK", "ADJUSTMENT"]);

const VARIANT_NOT_FOUND = "تنوع مورد نظر یافت نشد";

export function toInventoryItem(row: InventoryVariantRow): InventoryItem {
  return {
    variantId: row.variantId,
    productId: row.productId,
    productTitle: row.productTitle,
    productStatus: row.productStatus,
    size: row.size,
    color: row.color,
    sku: row.sku,
    stock: row.stock,
    status: getStockStatus(row.stock),
    lastMovementAt: row.lastMovementAt ? row.lastMovementAt.toISOString() : null,
  };
}

export function toMovementEntry(row: MovementRow): InventoryMovementEntry {
  return {
    id: row.id,
    type: row.type,
    quantityDelta: row.quantityDelta,
    // previousQuantity ذخیره نمی‌شود؛ همیشه برابر stockAfter − quantityDelta است
    stockBefore: row.stockAfter - row.quantityDelta,
    stockAfter: row.stockAfter,
    reason: row.reason,
    actorName: MANUAL_TYPES.has(row.type) ? row.actorName : null,
    orderId: row.orderId,
    createdAt: row.createdAt.toISOString(),
  };
}

async function requireApprovedSeller(repository: InventoryRepository, userId: string): Promise<string> {
  const seller = await repository.findSellerByUserId(userId);
  if (!seller) throw new AuthorizationError("برای مدیریت موجودی ابتدا باید حساب فروشندگی ایجاد کنید");
  if (seller.status === "SUSPENDED") throw new AuthorizationError("حساب فروشندگی شما مسدود شده است");
  if (seller.status !== "APPROVED") throw new AuthorizationError("حساب فروشندگی شما هنوز تأیید نشده است");
  return seller.id;
}

export interface InventoryService {
  assertCanManage(userId: string): Promise<void>;
  list(userId: string, query: SellerInventoryQuery): Promise<SellerInventoryList>;
  movements(
    userId: string,
    variantId: string,
    query: InventoryMovementsQuery,
  ): Promise<InventoryMovementsResult>;
  restock(userId: string, variantId: string, input: RestockInput): Promise<InventoryMutationResult>;
  adjust(userId: string, variantId: string, input: AdjustStockInput): Promise<InventoryMutationResult>;
}

export function createInventoryService(repository: InventoryRepository): InventoryService {
  async function mutate(
    userId: string,
    variantId: string,
    change: StockChange,
    type: "RESTOCK" | "ADJUSTMENT",
    reason: string,
  ): Promise<InventoryMutationResult> {
    const sellerId = await requireApprovedSeller(repository, userId);
    // actorId از توکن می‌آید؛ sellerId از دیتابیس. هیچ‌کدام از Body نیست.
    const result = await repository.applyStockChange(sellerId, variantId, change, {
      type,
      reason,
      actorId: userId,
    });
    // برای Variant فروشنده دیگر هم 404 (نه 403) تا وجودش فاش نشود
    if (!result) throw new NotFoundError(VARIANT_NOT_FOUND);
    return { item: toInventoryItem(result.variant), movement: toMovementEntry(result.movement) };
  }

  return {
    async assertCanManage(userId) {
      await requireApprovedSeller(repository, userId);
    },

    async list(userId, query) {
      const sellerId = await requireApprovedSeller(repository, userId);
      const [{ items, total }, counts] = await Promise.all([
        repository.list(sellerId, { ...query, lowStockThreshold: LOW_STOCK_THRESHOLD }),
        repository.counts(sellerId, LOW_STOCK_THRESHOLD),
      ]);
      return {
        data: items.map(toInventoryItem),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
        summary: { ...counts, lowStockThreshold: LOW_STOCK_THRESHOLD },
      };
    },

    async movements(userId, variantId, query) {
      const sellerId = await requireApprovedSeller(repository, userId);
      const variant = await repository.findOwnedVariant(sellerId, variantId);
      if (!variant) throw new NotFoundError(VARIANT_NOT_FOUND);
      const { items, total } = await repository.listMovements(variantId, query);
      return {
        variant: toInventoryItem(variant),
        data: items.map(toMovementEntry),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
      };
    },

    restock(userId, variantId, input) {
      return mutate(userId, variantId, { kind: "DELTA", delta: input.quantity }, "RESTOCK", input.reason);
    },

    adjust(userId, variantId, input) {
      const change: StockChange =
        input.newQuantity !== undefined
          ? { kind: "SET", quantity: input.newQuantity }
          : { kind: "DELTA", delta: input.delta ?? 0 };
      return mutate(userId, variantId, change, "ADJUSTMENT", input.reason);
    },
  };
}
