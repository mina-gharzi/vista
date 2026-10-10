import type { PaginatedResponse } from "./api";
import { LOW_STOCK_THRESHOLD } from "./sellerDashboard";

/**
 * مدیریت موجودی فروشنده.
 * منبع حقیقت موجودی = ProductVariant.stock (فقط داخل Transaction در Backend تغییر می‌کند)؛
 * InventoryMovement دفتر کل (Audit Trail) همان تغییرات است و هیچ‌گاه منبع دوم موجودی نیست.
 */

/** سقف موجودی هر تنوع (همان سقف ثبت موجودی اولیه در createVariantSchema) */
export const MAX_VARIANT_STOCK = 1_000_000;

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

/** تنها نقطه تصمیم‌گیری وضعیت موجودی؛ آستانه از LOW_STOCK_THRESHOLD مشترک با داشبورد می‌آید */
export function getStockStatus(stock: number): StockStatus {
  if (stock <= 0) return "OUT_OF_STOCK";
  if (stock <= LOW_STOCK_THRESHOLD) return "LOW_STOCK";
  return "IN_STOCK";
}

export type InventoryMovementType =
  | "INITIAL"
  | "RESTOCK"
  | "ADJUSTMENT"
  | "ORDER_PLACED"
  | "ORDER_CANCELLED"
  | "RETURN";

export interface InventoryItem {
  variantId: string;
  productId: string;
  productTitle: string;
  productStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  size: string;
  color: string;
  sku: string;
  stock: number;
  status: StockStatus;
  /** زمان آخرین حرکت انبار؛ Variant بدون تاریخچه null است */
  lastMovementAt: string | null;
}

/** شمارش کل موجودی فروشنده، مستقل از جستجو/فیلتر صفحه */
export interface InventorySummary {
  totalVariants: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  /** جمع واحدهای موجود در انبار (on-hand؛ نه «قابل فروش» بعد از رزرو) */
  totalUnits: number;
  lowStockThreshold: number;
}

export interface SellerInventoryList extends PaginatedResponse<InventoryItem> {
  summary: InventorySummary;
}

export interface InventoryMovementEntry {
  id: string;
  type: InventoryMovementType;
  quantityDelta: number;
  stockBefore: number;
  stockAfter: number;
  reason: string | null;
  /** فقط برای تغییرات دستی فروشنده/ادمین؛ برای سفارش‌ها (مشتری) همیشه null */
  actorName: string | null;
  /** ارجاع به سفارش در حرکت‌های مرتبط با سفارش */
  orderId: string | null;
  createdAt: string;
}

export interface InventoryMovementsResult extends PaginatedResponse<InventoryMovementEntry> {
  variant: InventoryItem;
}

/** نتیجه Restock/Adjust: وضعیت جدید + حرکت ثبت‌شده */
export interface InventoryMutationResult {
  item: InventoryItem;
  movement: InventoryMovementEntry;
}
