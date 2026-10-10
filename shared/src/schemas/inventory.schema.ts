import { z } from "zod";
import { MAX_VARIANT_STOCK } from "../types/inventory";

const reasonSchema = z
  .string({ required_error: "دلیل الزامی است", invalid_type_error: "دلیل معتبر نیست" })
  .trim()
  .min(1, "دلیل الزامی است")
  .min(3, "دلیل باید حداقل ۳ کاراکتر باشد")
  .max(300, "دلیل نباید بیشتر از ۳۰۰ کاراکتر باشد");

export const inventoryVariantParamsSchema = z.object({
  variantId: z.string().uuid("شناسه معتبر نیست"),
});

export const inventoryStatusSchema = z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"], {
  errorMap: () => ({ message: "وضعیت موجودی معتبر نیست" }),
});

export const sellerInventoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: inventoryStatusSchema.optional(),
  /** جستجو در عنوان محصول، SKU، رنگ و سایز */
  q: z
    .string()
    .trim()
    .max(100)
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});
export type SellerInventoryQuery = z.infer<typeof sellerInventoryQuerySchema>;

export const inventoryMovementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type InventoryMovementsQuery = z.infer<typeof inventoryMovementsQuerySchema>;

export const restockSchema = z.object({
  quantity: z
    .number({ required_error: "تعداد الزامی است", invalid_type_error: "تعداد باید عدد باشد" })
    .int("تعداد باید عدد صحیح باشد")
    .min(1, "تعداد باید حداقل ۱ باشد")
    .max(MAX_VARIANT_STOCK, "تعداد بیش از حد بزرگ است"),
  reason: reasonSchema,
});
export type RestockInput = z.infer<typeof restockSchema>;

/**
 * اصلاح دستی: دقیقاً یکی از دو شکل
 *  - newQuantity: موجودی نهایی (مثلاً بعد از شمارش انبار)
 *  - delta: تغییر علامت‌دار نسبت به موجودی «لحظه اعمال» (نه لحظه نمایش)
 * دلیل اجباری است. منفی‌شدن موجودی در سرویس/دیتابیس رد می‌شود.
 */
export const adjustStockSchema = z
  .object({
    newQuantity: z
      .number({ invalid_type_error: "موجودی جدید باید عدد باشد" })
      .int("موجودی جدید باید عدد صحیح باشد")
      .min(0, "موجودی نمی‌تواند منفی باشد")
      .max(MAX_VARIANT_STOCK, "موجودی بیش از حد بزرگ است")
      .optional(),
    delta: z
      .number({ invalid_type_error: "مقدار تغییر باید عدد باشد" })
      .int("مقدار تغییر باید عدد صحیح باشد")
      .min(-MAX_VARIANT_STOCK, "مقدار تغییر بیش از حد بزرگ است")
      .max(MAX_VARIANT_STOCK, "مقدار تغییر بیش از حد بزرگ است")
      .optional(),
    reason: reasonSchema,
  })
  .superRefine((data, ctx) => {
    const hasQuantity = data.newQuantity !== undefined;
    const hasDelta = data.delta !== undefined;
    if (hasQuantity === hasDelta) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [hasQuantity ? "delta" : "newQuantity"],
        message: "فقط یکی از «موجودی جدید» یا «مقدار تغییر» را وارد کنید",
      });
    }
  });
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
