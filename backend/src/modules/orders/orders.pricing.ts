import { categoryChainOf, type PricedLine } from "../coupons/coupons.engine";
import type { CartLine } from "./orders.repository";

/** قیمت واحد = قیمت تنوع، در غیر این صورت قیمت پایهٔ محصول (همیشه از دیتابیس) */
export const unitPriceOf = (line: Pick<CartLine, "variantPrice" | "basePrice">): number =>
  line.variantPrice ?? line.basePrice;

/**
 * تنها محل محاسبهٔ مبلغ نهایی؛ هم Checkout و هم پیش‌نمایش کوپن از همین تابع استفاده می‌کنند تا
 * مبلغی که کاربر می‌بیند با مبلغ ثبت‌شده هیچ‌وقت فرق نکند.
 * ارسال در این نسخه قانون پیاده‌سازی‌شده ندارد (صفر صریح). تخفیف از موتور کوپن می‌آید و
 * هرگز از subtotal بیشتر نیست، پس مبلغ نهایی منفی نمی‌شود (CHECK دیتابیس هم تضمین می‌کند).
 */
export function computeCharges(
  subtotal: number,
  discountAmount = 0,
): { shippingCost: number; discountAmount: number; totalAmount: number } {
  const shippingCost = 0;
  const safeDiscount = Math.min(Math.max(0, discountAmount), subtotal);
  return { shippingCost, discountAmount: safeDiscount, totalAmount: subtotal + shippingCost - safeDiscount };
}

/** نگاشت خطوط سبد به ورودی موتور کوپن (قیمت و دسته فقط از دیتابیس) */
export function toPricedLines(
  lines: readonly CartLine[],
  parents: ReadonlyMap<string, string | null>,
): PricedLine[] {
  return lines.map((line) => ({
    variantId: line.variantId,
    productId: line.productId,
    sellerId: line.sellerId,
    categoryChain: categoryChainOf(line.categoryId, parents),
    unitPrice: unitPriceOf(line),
    quantity: line.quantity,
  }));
}
