import { z } from "zod";

export const sellerOrderParamsSchema = z.object({
  sellerOrderId: z.string().uuid("شناسه معتبر نیست"),
});

const FULFILLMENT_STATUSES = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

/** تاریخ میلادی YYYY-MM-DD که واقعاً وجود دارد (۲۰۲۶-۰۲-۳۱ رد می‌شود) */
export function isRealDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const dateOnlySchema = z
  .string()
  .refine(isRealDateOnly, "تاریخ معتبر نیست (قالب YYYY-MM-DD)");

export const sellerOrdersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(FULFILLMENT_STATUSES, { errorMap: () => ({ message: "وضعیت سفارش معتبر نیست" }) }).optional(),
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
    /** جستجو فقط بر اساس شماره سفارش (عدد) */
    q: z
      .string()
      .trim()
      .max(20, "شماره سفارش معتبر نیست")
      .transform((value) => (value === "" ? undefined : value))
      .refine((value) => value === undefined || /^\d{1,9}$/.test(value), "شماره سفارش باید فقط عدد باشد")
      .optional(),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: "تاریخ شروع نباید بعد از تاریخ پایان باشد",
    path: ["from"],
  });
export type SellerOrdersQuery = z.infer<typeof sellerOrdersQuerySchema>;

export const trackingCodeSchema = z
  .string({ invalid_type_error: "کد رهگیری معتبر نیست" })
  .trim()
  .min(4, "کد رهگیری باید حداقل ۴ کاراکتر باشد")
  .max(40, "کد رهگیری نباید بیشتر از ۴۰ کاراکتر باشد")
  .regex(/^[A-Za-z0-9][A-Za-z0-9\-_/]*$/, "کد رهگیری فقط می‌تواند شامل حروف انگلیسی، عدد، خط تیره و اسلش باشد");

/**
 * تنها ورودی تغییر وضعیت. عمداً strict: هر فیلد دیگری (قیمت، وضعیت پرداخت، sellerId، ...) رد می‌شود
 * نه اینکه بی‌صدا نادیده گرفته شود.
 */
export const updateSellerOrderStatusSchema = z
  .object({
    status: z.enum(["PROCESSING", "SHIPPED", "DELIVERED"], {
      errorMap: () => ({ message: "وضعیت مقصد معتبر نیست" }),
    }),
    trackingCode: trackingCodeSchema.optional(),
  })
  .strict("فیلد غیرمجاز در درخواست وجود دارد")
  .superRefine((data, ctx) => {
    if (data.status === "SHIPPED" && data.trackingCode === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trackingCode"],
        message: "کد رهگیری برای ثبت ارسال الزامی است",
      });
    }
    if (data.status !== "SHIPPED" && data.trackingCode !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trackingCode"],
        message: "کد رهگیری فقط هنگام ثبت ارسال معنا دارد",
      });
    }
  });
export type UpdateSellerOrderStatusInput = z.infer<typeof updateSellerOrderStatusSchema>;
