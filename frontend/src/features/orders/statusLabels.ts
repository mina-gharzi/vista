import type { FulfillmentStatus, OrderStatus } from "@vista/shared";
import type { BadgeVariant } from "@/components/ui";

export const orderStatusLabel: Record<OrderStatus, string> = {
  PENDING: "در انتظار پرداخت",
  PAID: "پرداخت‌شده",
  CANCELLED: "لغوشده",
  REFUNDED: "بازگشت‌داده‌شده",
};

export const orderStatusBadge: Record<OrderStatus, BadgeVariant> = {
  PENDING: "warning",
  PAID: "success",
  CANCELLED: "danger",
  REFUNDED: "neutral",
};

export const fulfillmentStatusLabel: Record<FulfillmentStatus, string> = {
  PENDING: "در انتظار آماده‌سازی",
  PROCESSING: "در حال آماده‌سازی",
  SHIPPED: "ارسال‌شده",
  DELIVERED: "تحویل‌شده",
  CANCELLED: "لغوشده",
};

export const fulfillmentStatusBadge: Record<FulfillmentStatus, BadgeVariant> = {
  PENDING: "neutral",
  PROCESSING: "brand",
  SHIPPED: "premium",
  DELIVERED: "success",
  CANCELLED: "danger",
};
