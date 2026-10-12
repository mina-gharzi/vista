import { CHECKOUT_ERROR_CODES, type CheckoutUnavailableReason } from "@vista/shared";
import { AppError } from "../../errors/AppError";

/** سبد خالی است (مثلاً بعد از ثبت موفق در تب دیگر) */
export class CheckoutEmptyCartError extends AppError {
  constructor() {
    super("سبد خرید شما خالی است", 409, CHECKOUT_ERROR_CODES.EMPTY_CART);
  }
}

export interface UnavailableLine {
  variantId: string;
  productTitle: string;
  reason: CheckoutUnavailableReason;
  availableStock: number;
}

const REASON_TEXT: Record<CheckoutUnavailableReason, string> = {
  UNAVAILABLE: "دیگر در دسترس نیست",
  INSUFFICIENT_STOCK: "موجودی کافی ندارد",
};

/**
 * همهٔ کالاهای مشکل‌دار یک‌جا برگردانده می‌شوند.
 * فرمت details: برای هر variantId یک کلید → [reason, availableStock]؛ مثال:
 *   { "<variantId>": ["INSUFFICIENT_STOCK", "2"] }
 */
export class CheckoutItemsUnavailableError extends AppError {
  constructor(public readonly lines: UnavailableLine[]) {
    super(
      `برخی کالاهای سبد خرید در دسترس نیستند: ${lines
        .map((line) => `${line.productTitle} (${REASON_TEXT[line.reason]})`)
        .join("، ")}`,
      409,
      CHECKOUT_ERROR_CODES.ITEMS_UNAVAILABLE,
      Object.fromEntries(
        lines.map((line) => [line.variantId, [line.reason, String(line.availableStock)]]),
      ),
    );
  }
}

/** مبلغی که کاربر دید با مبلغ فعلی محاسبه‌شدهٔ Server فرق دارد؛ سفارشی ثبت نشده است */
export class CheckoutPriceChangedError extends AppError {
  constructor(expectedTotal: number, actualTotal: number) {
    super(
      "قیمت کالاهای سبد تغییر کرده است. لطفاً مبلغ جدید را بررسی و دوباره تأیید کنید.",
      409,
      CHECKOUT_ERROR_CODES.PRICE_CHANGED,
      { expectedTotal: [String(expectedTotal)], actualTotal: [String(actualTotal)] },
    );
  }
}

export class OrderNotCancellableError extends AppError {
  constructor(message: string) {
    super(message, 409, CHECKOUT_ERROR_CODES.ORDER_NOT_CANCELLABLE);
  }
}
