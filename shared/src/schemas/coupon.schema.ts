import { z } from "zod";
import type { CouponDiscountType } from "../types/coupon";

/** سقف مبالغ کوپن (تومان) — زیر سقف Int دیتابیس (۲٫۱ میلیارد) تا هیچ جمعی سرریز نکند */
export const MAX_COUPON_AMOUNT = 1_000_000_000;
export const MAX_COUPON_USAGE_LIMIT = 1_000_000;
export const MAX_COUPON_PER_USER_LIMIT = 1_000;
export const MAX_COUPON_PRODUCTS = 50;
export const MAX_COUPON_CATEGORIES = 20;
export const COUPON_CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;

const PERSIAN_DIGIT_BASE = 0x06f0;
const ARABIC_DIGIT_BASE = 0x0660;
// فاصله، نیم‌فاصله، علائم جهت و کاراکترهای نامرئی
/* eslint-disable no-misleading-character-class */
const INVISIBLE = /[\s\u200B\u200C\u200D\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
/* eslint-enable no-misleading-character-class */

/**
 * نرمال‌سازی یکسان «کد کوپن» برای ذخیره و جستجو: ارقام فارسی/عربی → لاتین، NFKC (حروف تمام‌عرض)،
 * حذف فاصله/نیم‌فاصله/کاراکتر نامرئی و حروف بزرگ. بنابراین «summer10» و «SUMMER۱۰» یک کدند.
 */
export function normalizeCouponCode(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[۰-۹٠-٩]/g, (char) => {
      const code = char.charCodeAt(0);
      return String(code >= PERSIAN_DIGIT_BASE ? code - PERSIAN_DIGIT_BASE : code - ARABIC_DIGIT_BASE);
    })
    .replace(INVISIBLE, "")
    .toUpperCase();
}

export function isValidCouponCode(normalized: string): boolean {
  return COUPON_CODE_PATTERN.test(normalized);
}

const uuid = (message: string) => z.string().uuid(message);

const amount = (label: string) =>
  z
    .number({ invalid_type_error: `${label} باید عدد باشد` })
    .int(`${label} باید عدد صحیح باشد`)
    .min(1, `${label} باید بزرگ‌تر از صفر باشد`)
    .max(MAX_COUPON_AMOUNT, `${label} بیش از حد مجاز است`);

const isoDate = z
  .string({ invalid_type_error: "تاریخ معتبر نیست" })
  .datetime({ offset: true, message: "تاریخ معتبر نیست" });

/** فیلدهای قابل‌ویرایش یک کوپن، بدون خود کد */
const couponFields = {
  description: z
    .string()
    .trim()
    .max(200, "توضیح نباید بیشتر از ۲۰۰ کاراکتر باشد")
    .nullable()
    .optional(),
  discountType: z.enum(["FIXED", "PERCENTAGE"], {
    errorMap: () => ({ message: "نوع تخفیف معتبر نیست" }),
  }),
  discountValue: z
    .number({ invalid_type_error: "مقدار تخفیف باید عدد باشد" })
    .int("مقدار تخفیف باید عدد صحیح باشد")
    .min(1, "مقدار تخفیف باید بزرگ‌تر از صفر باشد")
    .max(MAX_COUPON_AMOUNT, "مقدار تخفیف بیش از حد مجاز است"),
  maxDiscountAmount: amount("سقف تخفیف").nullable().optional(),
  minPurchaseAmount: amount("حداقل خرید").nullable().optional(),
  startsAt: isoDate.nullable().optional(),
  expiresAt: isoDate.nullable().optional(),
  usageLimit: z
    .number({ invalid_type_error: "سقف کل استفاده باید عدد باشد" })
    .int("سقف کل استفاده باید عدد صحیح باشد")
    .min(1, "سقف کل استفاده باید حداقل ۱ باشد")
    .max(MAX_COUPON_USAGE_LIMIT, "سقف کل استفاده بیش از حد مجاز است")
    .nullable()
    .optional(),
  perUserLimit: z
    .number({ invalid_type_error: "سقف هر مشتری باید عدد باشد" })
    .int("سقف هر مشتری باید عدد صحیح باشد")
    .min(1, "سقف هر مشتری باید حداقل ۱ باشد")
    .max(MAX_COUPON_PER_USER_LIMIT, "سقف هر مشتری بیش از حد مجاز است")
    .nullable()
    .optional(),
  sellerId: uuid("فروشنده معتبر نیست").nullable().optional(),
  productIds: z
    .array(uuid("محصول معتبر نیست"))
    .max(MAX_COUPON_PRODUCTS, `حداکثر ${MAX_COUPON_PRODUCTS} محصول مجاز است`)
    .optional(),
  categoryIds: z
    .array(uuid("دسته‌بندی معتبر نیست"))
    .max(MAX_COUPON_CATEGORIES, `حداکثر ${MAX_COUPON_CATEGORIES} دسته‌بندی مجاز است`)
    .optional(),
  isActive: z.boolean({ invalid_type_error: "وضعیت معتبر نیست" }).optional(),
};

/** حالت «کامل‌شدهٔ» یک کوپن برای اعتبارسنجی بین‌فیلدی (در ساخت و بعد از ادغام ویرایش) */
export interface CouponRuleFields {
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount: number | null;
  minPurchaseAmount: number | null;
  startsAt: string | Date | null;
  expiresAt: string | Date | null;
  usageLimit: number | null;
  perUserLimit: number | null;
}

/**
 * قوانین بین‌فیلدی؛ خروجی = نگاشت فیلد → پیام (خالی = معتبر).
 * هم در Zod (ساخت) و هم در Service (بعد از ادغام ویرایش با مقدار فعلی) استفاده می‌شود تا یک قانون واحد باشد.
 */
export function checkCouponRules(rules: CouponRuleFields): Record<string, string> {
  const errors: Record<string, string> = {};
  if (rules.discountType === "PERCENTAGE") {
    if (rules.discountValue < 1 || rules.discountValue > 100) {
      errors.discountValue = "درصد تخفیف باید بین ۱ تا ۱۰۰ باشد";
    }
  } else {
    if (rules.maxDiscountAmount !== null) {
      errors.maxDiscountAmount = "سقف تخفیف فقط برای کوپن درصدی معنا دارد";
    }
  }
  if (rules.startsAt !== null && rules.expiresAt !== null) {
    if (new Date(rules.expiresAt).getTime() <= new Date(rules.startsAt).getTime()) {
      errors.expiresAt = "تاریخ پایان باید بعد از تاریخ شروع باشد";
    }
  }
  if (rules.usageLimit !== null && rules.perUserLimit !== null && rules.perUserLimit > rules.usageLimit) {
    errors.perUserLimit = "سقف هر مشتری نباید از سقف کل بیشتر باشد";
  }
  return errors;
}

export const couponCodeSchema = z
  .string({ required_error: "کد کوپن الزامی است", invalid_type_error: "کد کوپن معتبر نیست" })
  .max(64, "کد کوپن معتبر نیست")
  .transform(normalizeCouponCode)
  .refine(isValidCouponCode, "کد باید ۳ تا ۳۲ کاراکتر و فقط شامل حروف انگلیسی، رقم، خط تیره یا زیرخط باشد");

function applyRules(
  data: {
    discountType: CouponDiscountType;
    discountValue: number;
    maxDiscountAmount?: number | null | undefined;
    minPurchaseAmount?: number | null | undefined;
    startsAt?: string | null | undefined;
    expiresAt?: string | null | undefined;
    usageLimit?: number | null | undefined;
    perUserLimit?: number | null | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  const errors = checkCouponRules({
    discountType: data.discountType,
    discountValue: data.discountValue,
    maxDiscountAmount: data.maxDiscountAmount ?? null,
    minPurchaseAmount: data.minPurchaseAmount ?? null,
    startsAt: data.startsAt ?? null,
    expiresAt: data.expiresAt ?? null,
    usageLimit: data.usageLimit ?? null,
    perUserLimit: data.perUserLimit ?? null,
  });
  for (const [path, message] of Object.entries(errors)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  }
}

export const createCouponSchema = z
  .object({ code: couponCodeSchema, ...couponFields })
  .strict()
  .superRefine(applyRules);
export type CreateCouponInput = z.infer<typeof createCouponSchema>;

/**
 * ویرایش: کد تغییرناپذیر است (strict آن را رد می‌کند). فقط فیلدهای ارسال‌شده عوض می‌شوند؛ قوانین
 * بین‌فیلدی در Service روی «حالت ادغام‌شده» دوباره سنجیده می‌شود.
 */
export const updateCouponSchema = z
  .object({
    description: couponFields.description,
    discountType: couponFields.discountType.optional(),
    discountValue: couponFields.discountValue.optional(),
    maxDiscountAmount: couponFields.maxDiscountAmount,
    minPurchaseAmount: couponFields.minPurchaseAmount,
    startsAt: couponFields.startsAt,
    expiresAt: couponFields.expiresAt,
    usageLimit: couponFields.usageLimit,
    perUserLimit: couponFields.perUserLimit,
    sellerId: couponFields.sellerId,
    productIds: couponFields.productIds,
    categoryIds: couponFields.categoryIds,
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: "حداقل یک فیلد برای ویرایش لازم است" });
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;

export const couponStatusSchema = z
  .object({ isActive: z.boolean({ required_error: "وضعیت الزامی است", invalid_type_error: "وضعیت معتبر نیست" }) })
  .strict();
export type CouponStatusInput = z.infer<typeof couponStatusSchema>;

export const couponIdParamSchema = z.object({ couponId: uuid("شناسه کوپن معتبر نیست") });

const search = z
  .string()
  .trim()
  .max(64)
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const adminCouponsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** جستجو در کد کوپن */
  q: search,
  isActive: z
    .enum(["true", "false"], { errorMap: () => ({ message: "وضعیت معتبر نیست" }) })
    .transform((value) => value === "true")
    .optional(),
});
export type AdminCouponsQuery = z.infer<typeof adminCouponsQuerySchema>;

/** بدنهٔ اعتبارسنجی کوپن روی سبد (مشتری). کد نامعتبر عمداً 400 نیست؛ در Service «کد معتبر نیست» می‌شود. */
export const validateCouponSchema = z
  .object({
    code: z
      .string({ required_error: "کد تخفیف را وارد کنید", invalid_type_error: "کد تخفیف معتبر نیست" })
      .trim()
      .min(1, "کد تخفیف را وارد کنید")
      .max(64, "کد تخفیف معتبر نیست"),
  })
  .strict();
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;
