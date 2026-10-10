import type { InventoryMovementType, StockStatus } from "@vista/shared";
import type { BadgeVariant } from "@/components/ui";
import { formatNumber } from "@/lib/utils/format";

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  IN_STOCK: "موجود",
  LOW_STOCK: "رو به اتمام",
  OUT_OF_STOCK: "ناموجود",
};

export const STOCK_STATUS_VARIANT: Record<StockStatus, BadgeVariant> = {
  IN_STOCK: "success",
  LOW_STOCK: "warning",
  OUT_OF_STOCK: "danger",
};

export const MOVEMENT_TYPE_LABEL: Record<InventoryMovementType, string> = {
  INITIAL: "موجودی اولیه",
  RESTOCK: "تأمین مجدد",
  ADJUSTMENT: "اصلاح دستی",
  ORDER_PLACED: "ثبت سفارش",
  ORDER_CANCELLED: "لغو سفارش",
  RETURN: "مرجوعی",
};

/** +۵ / −۳ (علامت منفی واقعی ریاضی، نه خط تیره) */
export function formatDelta(delta: number): string {
  if (delta > 0) return `+${formatNumber(delta)}`;
  if (delta < 0) return `−${formatNumber(Math.abs(delta))}`;
  return formatNumber(0);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
