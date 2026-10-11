import { FULFILLMENT_STATUS_LABEL, type FulfillmentStatus, type OrderStatus } from "@vista/shared";
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

/** منبع واحد در @vista/shared: پیام‌های Backend و تمام صفحه‌ها یک متن را نشان می‌دهند */
export const fulfillmentStatusLabel: Record<FulfillmentStatus, string> = FULFILLMENT_STATUS_LABEL;

export const fulfillmentStatusBadge: Record<FulfillmentStatus, BadgeVariant> = {
  PENDING: "neutral",
  PROCESSING: "brand",
  SHIPPED: "premium",
  DELIVERED: "success",
  CANCELLED: "danger",
};
