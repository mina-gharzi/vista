import { z } from "zod";

/**
 * checkoutKey کلید یکتای «یک تلاش ثبت سفارش» است که Client قبل از ارسال تولید می‌کند (UUID) و در
 * تلاش‌های مجدد همان سبد/آدرس عیناً تکرار می‌کند. Server با (userId, checkoutKey) یکتایی را در دیتابیس
 * تضمین می‌کند: تکرار = همان سفارش، نه سفارش دوم.
 *
 * expectedTotal فقط برای «تأیید مبلغ دیده‌شده توسط کاربر» است؛ هرگز مبنای محاسبه نیست. اگر با مبلغ
 * محاسبه‌شده توسط Server یکی نباشد، سفارش ثبت نمی‌شود و کاربر باید مبلغ جدید را تأیید کند.
 */
export const checkoutSchema = z.object({
  addressId: z.string().uuid("آدرس معتبر نیست"),
  checkoutKey: z.string().uuid("کلید ثبت سفارش معتبر نیست"),
  expectedTotal: z.number().int("مبلغ معتبر نیست").min(0, "مبلغ معتبر نیست").optional(),
  /**
   * کد کوپن اختیاری. فقط «کد» پذیرفته می‌شود؛ مبلغ تخفیف/مشمولیت هرگز از Client خوانده نمی‌شود و Server
   * در همین Transaction دوباره اعتبارسنجی و محاسبه می‌کند. رشتهٔ خالی = بدون کوپن.
   */
  couponCode: z
    .string({ invalid_type_error: "کد تخفیف معتبر نیست" })
    .trim()
    .max(64, "کد تخفیف معتبر نیست")
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const orderStatusFilterSchema = z.enum(["PENDING", "PAID", "CANCELLED", "REFUNDED"], {
  errorMap: () => ({ message: "وضعیت سفارش معتبر نیست" }),
});

export const ordersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: orderStatusFilterSchema.optional(),
});

export type OrdersQuery = z.infer<typeof ordersQuerySchema>;

export const orderIdParamSchema = z.object({ id: z.string().uuid("شناسه سفارش معتبر نیست") });
