import { CHECKOUT_ERROR_CODES } from "@vista/shared";
import { ApiRequestError } from "@/lib/api/client";
import { firstBackendErrors } from "@/lib/utils/zod";

export type CheckoutErrorKind =
  | "price_changed"
  | "unavailable"
  | "empty_cart"
  | "auth"
  | "address_missing"
  | "validation"
  | "retryable"
  | "other";

export interface UnavailableInfo {
  reason: "UNAVAILABLE" | "INSUFFICIENT_STOCK";
  availableStock: number;
}

export interface DescribedCheckoutError {
  kind: CheckoutErrorKind;
  message: string;
  fieldErrors: Record<string, string>;
  /** برای kind=unavailable: variantId → دلیل */
  unavailable: Record<string, UnavailableInfo>;
  /** برای kind=price_changed: مبلغ فعلی محاسبه‌شدهٔ سرور */
  actualTotal: number | null;
  /** درخواست ممکن است به سرور رسیده باشد؛ تلاش مجدد باید با «همان کلید» انجام شود */
  keepKey: boolean;
}

const GENERIC = "ثبت سفارش انجام نشد. لطفاً دوباره تلاش کنید.";

const base = (kind: CheckoutErrorKind, message: string): DescribedCheckoutError => ({
  kind,
  message,
  fieldErrors: {},
  unavailable: {},
  actualTotal: null,
  keepKey: false,
});

/** خطای Checkout را به یکی از حالت‌های قابل‌مدیریت UI تبدیل می‌کند؛ پیام خام 5xx هرگز نشان داده نمی‌شود. */
export function describeCheckoutError(error: unknown): DescribedCheckoutError {
  if (!(error instanceof ApiRequestError)) return { ...base("retryable", GENERIC), keepKey: true };

  if (error.code === "NETWORK_ERROR") {
    return { ...base("retryable", error.message), keepKey: true };
  }
  if (error.status === 401) {
    return base("auth", "نشست شما منقضی شده است. لطفاً دوباره وارد شوید.");
  }
  if (error.code === CHECKOUT_ERROR_CODES.PRICE_CHANGED) {
    const actual = Number(error.details?.actualTotal?.[0]);
    return {
      ...base("price_changed", error.message),
      actualTotal: Number.isFinite(actual) ? actual : null,
    };
  }
  if (error.code === CHECKOUT_ERROR_CODES.ITEMS_UNAVAILABLE) {
    const unavailable: Record<string, UnavailableInfo> = {};
    for (const [variantId, value] of Object.entries(error.details ?? {})) {
      const [reason, stock] = value;
      if (reason === "UNAVAILABLE" || reason === "INSUFFICIENT_STOCK") {
        unavailable[variantId] = { reason, availableStock: Number(stock) || 0 };
      }
    }
    return { ...base("unavailable", error.message), unavailable };
  }
  if (error.code === CHECKOUT_ERROR_CODES.EMPTY_CART) return base("empty_cart", error.message);
  if (error.status === 404) return base("address_missing", "آدرس انتخاب‌شده یافت نشد. آدرس دیگری انتخاب کنید.");
  if (error.status === 400) {
    return { ...base("validation", error.message), fieldErrors: firstBackendErrors(error.details) };
  }
  if (error.status === 429) return { ...base("retryable", error.message), keepKey: true };
  // 5xx: نتیجه نامعلوم است → تلاش مجدد با همان کلید امن است و سفارش تکراری نمی‌سازد
  return { ...base("retryable", GENERIC), keepKey: true };
}
