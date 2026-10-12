import {
  FULFILLMENT_STATUS_LABEL,
  ORDER_FULFILLMENT_STATE_LABEL,
  type FulfillmentStatus,
  type OrderFulfillmentState,
  type OrderStatus,
} from "@vista/shared";
import type { BadgeVariant } from "@/components/ui";

/** وضعیت «پرداخت» سفارش (Order.status) — جدا از وضعیت ارسال */
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

/** وضعیت «ارسال» کل سفارش (مشتق از SellerOrderها در Backend) */
export const fulfillmentStateLabel: Record<OrderFulfillmentState, string> = ORDER_FULFILLMENT_STATE_LABEL;

export const fulfillmentStateBadge: Record<OrderFulfillmentState, BadgeVariant> = {
  PENDING: "neutral",
  PROCESSING: "brand",
  PARTIALLY_SHIPPED: "premium",
  SHIPPED: "premium",
  DELIVERED: "success",
  CANCELLED: "danger",
};
