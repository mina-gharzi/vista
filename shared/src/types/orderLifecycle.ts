import type {
  FulfillmentStatus,
  OrderFulfillmentState,
  OrderFulfillmentSummary,
  OrderStatus,
} from "./order";

/**
 * منبع واحد قوانین چرخهٔ عمر سفارش مشتری (Backend تصمیم می‌گیرد؛ UI فقط نمایش می‌دهد).
 *
 * مدل وضعیت (دو محور جدا):
 *  - پرداخت = Order.status: PENDING → PAID (فقط از مسیر تأیید درگاه/سرور) | PENDING → CANCELLED (لغو مشتری)
 *    REFUNDED فقط برای Phase پرداخت و هنوز هیچ مسیری به آن نمی‌رسد.
 *  - ارسال = SellerOrder.status (فقط فروشنده تغییر می‌دهد، آن هم فقط وقتی Order والد PAID است).
 *  - وضعیت ارسال والد ذخیره نمی‌شود؛ همیشه با deriveOrderFulfillment از SellerOrderها محاسبه می‌شود.
 *
 * چرخهٔ موجودی: «کسر در لحظهٔ ثبت سفارش» (نه رزرو). موجودی با ثبت سفارش کم می‌شود و فقط
 * لغو سفارش پرداخت‌نشده آن را برمی‌گرداند. پرداخت یا اقدام فروشنده هرگز موجودی را دوباره تغییر نمی‌دهند.
 */

/** وضعیت‌های Order که لغو توسط مشتری از آن‌ها مجاز است */
export const CUSTOMER_CANCELLABLE_ORDER_STATUSES: readonly OrderStatus[] = ["PENDING"];

/**
 * لغو توسط مشتری فقط برای سفارش «پرداخت‌نشده» و فقط وقتی هیچ فروشنده‌ای شروع به کار نکرده مجاز است.
 * سفارش پرداخت‌شده به فرآیند بازگشت وجه نیاز دارد که هنوز پیاده‌سازی نشده است؛ پس لغو نمی‌شود.
 * لغو همیشه «کل سفارش والد» را شامل می‌شود (لغو جزئی بسته‌ها تعریف نشده است).
 */
export function isOrderCancellableByCustomer(
  orderStatus: OrderStatus,
  sellerOrderStatuses: readonly FulfillmentStatus[],
): boolean {
  return (
    CUSTOMER_CANCELLABLE_ORDER_STATUSES.includes(orderStatus) &&
    sellerOrderStatuses.every((status) => status === "PENDING")
  );
}

/** خلاصهٔ پیشرفت ارسال والد از روی وضعیت SellerOrderها */
export function deriveOrderFulfillment(
  sellerOrderStatuses: readonly FulfillmentStatus[],
): OrderFulfillmentSummary {
  const active = sellerOrderStatuses.filter((status) => status !== "CANCELLED");
  const shippedParcels = active.filter((s) => s === "SHIPPED" || s === "DELIVERED").length;
  const deliveredParcels = active.filter((s) => s === "DELIVERED").length;
  const totalParcels = active.length;

  let state: OrderFulfillmentState;
  if (sellerOrderStatuses.length > 0 && totalParcels === 0) {
    state = "CANCELLED";
  } else if (totalParcels === 0 || active.every((s) => s === "PENDING")) {
    state = "PENDING";
  } else if (deliveredParcels === totalParcels) {
    state = "DELIVERED";
  } else if (shippedParcels === totalParcels) {
    state = "SHIPPED";
  } else if (shippedParcels > 0) {
    state = "PARTIALLY_SHIPPED";
  } else {
    state = "PROCESSING";
  }

  return { state, totalParcels, shippedParcels, deliveredParcels };
}

export const ORDER_FULFILLMENT_STATE_LABEL: Record<OrderFulfillmentState, string> = {
  PENDING: "در انتظار آماده‌سازی",
  PROCESSING: "در حال آماده‌سازی",
  PARTIALLY_SHIPPED: "بخشی از بسته‌ها ارسال شده",
  SHIPPED: "ارسال‌شده",
  DELIVERED: "تحویل‌شده",
  CANCELLED: "لغوشده",
};

/** کدهای خطای Checkout/لغو (فیلد error.code در پاسخ API) — Frontend فقط با همین‌ها تصمیم می‌گیرد */
export const CHECKOUT_ERROR_CODES = {
  EMPTY_CART: "CHECKOUT_EMPTY_CART",
  ITEMS_UNAVAILABLE: "CHECKOUT_ITEMS_UNAVAILABLE",
  PRICE_CHANGED: "CHECKOUT_PRICE_CHANGED",
  ORDER_NOT_CANCELLABLE: "ORDER_NOT_CANCELLABLE",
} as const;

export type CheckoutUnavailableReason = "UNAVAILABLE" | "INSUFFICIENT_STOCK";
