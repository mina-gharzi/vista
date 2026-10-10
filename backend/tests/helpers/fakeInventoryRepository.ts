import { randomUUID } from "node:crypto";
import { getStockStatus } from "@vista/shared";
import { ConflictError } from "../../src/errors/AppError";
import {
  ARCHIVED_MESSAGE,
  resolveNextStock,
  type InventoryRepository,
  type InventoryVariantRow,
  type MovementRow,
} from "../../src/modules/inventory/inventory.repository";

type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

interface FakeVariant {
  id: string;
  productId: string;
  size: string;
  color: string;
  sku: string;
  stock: number;
  isActive: boolean;
}
interface FakeMovement extends MovementRow {
  variantId: string;
  actorId: string | null;
}

/**
 * Repository درون‌حافظه‌ای با همان قرارداد Repository واقعی.
 * قفل ردیف (FOR UPDATE) با صف Promise به ازای هر Variant شبیه‌سازی می‌شود و Rollback با Snapshot؛
 * قانون محاسبه موجودی همان resolveNextStock واقعی است.
 */
export function createFakeInventoryRepository() {
  const sellers: { id: string; userId: string; status: string }[] = [];
  const users = new Map<string, string>();
  const products: { id: string; sellerId: string; title: string; status: ProductStatus }[] = [];
  const variants: FakeVariant[] = [];
  const movements: FakeMovement[] = [];
  const locks = new Map<string, Promise<unknown>>();
  let clock = 1_700_000_000_000;
  /** تزریق خطا بعد از به‌روزرسانی موجودی و قبل از ثبت Movement (برای تست Rollback) */
  const faults = { failAfterStockUpdate: false };

  const rowOf = (v: FakeVariant): InventoryVariantRow => {
    const product = products.find((p) => p.id === v.productId)!;
    const last = movements
      .filter((m) => m.variantId === v.id)
      .reduce<Date | null>((acc, m) => (acc === null || m.createdAt > acc ? m.createdAt : acc), null);
    return {
      variantId: v.id,
      productId: v.productId,
      productTitle: product.title,
      productStatus: product.status,
      size: v.size,
      color: v.color,
      sku: v.sku,
      stock: v.stock,
      isActive: v.isActive,
      lastMovementAt: last,
    };
  };
  const scoped = (sellerId: string) =>
    variants.filter((v) => {
      const p = products.find((x) => x.id === v.productId)!;
      return p.sellerId === sellerId && p.status !== "ARCHIVED" && v.isActive;
    });
  const toMovementRow = (m: FakeMovement): MovementRow => {
    const { variantId: _v, actorId: _a, ...rest } = m;
    return rest;
  };

  const repository: InventoryRepository = {
    async findSellerByUserId(userId) {
      const s = sellers.find((x) => x.userId === userId);
      return s ? { id: s.id, status: s.status } : null;
    },

    async list(sellerId, { page, limit, status, q, lowStockThreshold }) {
      const needle = q?.toLowerCase();
      const filtered = scoped(sellerId)
        .filter((v) => {
          if (!status) return true;
          if (status === "OUT_OF_STOCK") return v.stock <= 0;
          if (status === "LOW_STOCK") return v.stock > 0 && v.stock <= lowStockThreshold;
          return v.stock > lowStockThreshold;
        })
        .filter((v) => {
          if (!needle) return true;
          const title = products.find((p) => p.id === v.productId)!.title;
          return [v.sku, v.color, v.size, title].some((s) => s.toLowerCase().includes(needle));
        })
        .map(rowOf)
        .sort((a, b) => a.productTitle.localeCompare(b.productTitle) || a.sku.localeCompare(b.sku));
      return { items: filtered.slice((page - 1) * limit, page * limit), total: filtered.length };
    },

    async counts(sellerId, threshold) {
      const all = scoped(sellerId);
      const status = (stock: number) => {
        if (stock <= 0) return "OUT";
        return stock <= threshold ? "LOW" : "IN";
      };
      return {
        totalVariants: all.length,
        inStockCount: all.filter((v) => status(v.stock) === "IN").length,
        lowStockCount: all.filter((v) => status(v.stock) === "LOW").length,
        outOfStockCount: all.filter((v) => status(v.stock) === "OUT").length,
        totalUnits: all.reduce((sum, v) => sum + v.stock, 0),
      };
    },

    async findOwnedVariant(sellerId, variantId) {
      const v = variants.find((x) => x.id === variantId);
      if (!v) return null;
      const p = products.find((x) => x.id === v.productId)!;
      return p.sellerId === sellerId ? rowOf(v) : null;
    },

    async listMovements(variantId, { page, limit }) {
      const all = movements
        .filter((m) => m.variantId === variantId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
        .map(toMovementRow);
      return { items: all.slice((page - 1) * limit, page * limit), total: all.length };
    },

    async applyStockChange(sellerId, variantId, change, meta) {
      const previous = locks.get(variantId) ?? Promise.resolve();
      const run = previous.catch(() => undefined).then(async () => {
        // نقطه قفل: از این‌جا تا پایان، هیچ تغییر همزمان دیگری روی همین Variant اجرا نمی‌شود
        await new Promise((r) => setImmediate(r)); // اجازه تداخل نوبت‌ها؛ بدون قفل، تست همزمانی شکست می‌خورد
        const v = variants.find((x) => x.id === variantId);
        const p = v && products.find((x) => x.id === v.productId);
        if (!v || !p || p.sellerId !== sellerId) return null;
        if (!v.isActive || p.status === "ARCHIVED") {
          throw new ConflictError(ARCHIVED_MESSAGE);
        }
        const snapshot = { stock: v.stock, movementCount: movements.length };
        try {
          const next = resolveNextStock(v.stock, change);
          const before = v.stock;
          v.stock = next;
          if (faults.failAfterStockUpdate) throw new Error("injected failure");
          const movement: FakeMovement = {
            id: randomUUID(),
            variantId,
            type: meta.type,
            quantityDelta: next - before,
            stockAfter: next,
            reason: meta.reason,
            actorId: meta.actorId,
            actorName: users.get(meta.actorId) ?? null,
            orderId: null,
            createdAt: new Date((clock += 1000)),
          };
          movements.push(movement);
          return { variant: rowOf(v), movement: toMovementRow(movement) };
        } catch (error) {
          v.stock = snapshot.stock; // Rollback
          movements.length = snapshot.movementCount;
          throw error;
        }
      });
      locks.set(variantId, run);
      return run;
    },
  };

  return {
    repository,
    faults,
    movements,
    variants,
    addUser(id: string, fullName: string) {
      users.set(id, fullName);
    },
    addSeller(userId: string, status: string): string {
      const id = randomUUID();
      sellers.push({ id, userId, status });
      return id;
    },
    addProduct(sellerId: string, title = "پیراهن", status: ProductStatus = "PUBLISHED"): string {
      const id = randomUUID();
      products.push({ id, sellerId, title, status });
      return id;
    },
    addVariant(
      productId: string,
      data: Partial<Omit<FakeVariant, "id" | "productId">> = {},
    ): string {
      const id = randomUUID();
      variants.push({
        id,
        productId,
        size: data.size ?? "M",
        color: data.color ?? "مشکی",
        sku: data.sku ?? `SKU-${variants.length + 1}`,
        stock: data.stock ?? 10,
        isActive: data.isActive ?? true,
      });
      return id;
    },
    /** حرکت دلخواه (مثلاً ORDER_PLACED با مشتری) برای تست حریم خصوصی */
    addMovement(
      variantId: string,
      data: { type: MovementRow["type"]; quantityDelta: number; stockAfter: number; actorId?: string; orderId?: string },
    ) {
      movements.push({
        id: randomUUID(),
        variantId,
        type: data.type,
        quantityDelta: data.quantityDelta,
        stockAfter: data.stockAfter,
        reason: null,
        actorId: data.actorId ?? null,
        actorName: data.actorId ? (users.get(data.actorId) ?? null) : null,
        orderId: data.orderId ?? null,
        createdAt: new Date((clock += 1000)),
      });
    },
    statusOf: getStockStatus,
  };
}
