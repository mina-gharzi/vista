import { z } from "zod";

const priceSchema = z
  .number({ invalid_type_error: "قیمت باید عدد باشد" })
  .int("قیمت باید عدد صحیح باشد")
  .positive("قیمت باید مثبت باشد")
  .max(1_000_000_000, "قیمت بیش از حد بزرگ است");

/** SKU: حروف انگلیسی بزرگ، عدد، خط تیره و آندرلاین؛ همیشه به حروف بزرگ نرمال می‌شود */
export const VARIANT_SKU_PATTERN = /^[A-Z0-9]+(?:[-_][A-Z0-9]+)*$/;

export const variantSkuSchema = z
  .string({ invalid_type_error: "SKU معتبر نیست" })
  .trim()
  .toUpperCase()
  .min(3, "SKU باید حداقل ۳ کاراکتر باشد")
  .max(40, "SKU نباید بیشتر از ۴۰ کاراکتر باشد")
  .regex(VARIANT_SKU_PATTERN, "SKU فقط می‌تواند شامل حروف انگلیسی، عدد، خط تیره و آندرلاین باشد");

/** فاصله‌های اضافه حذف و چند فاصله پشت‌سرهم یکی می‌شود */
const collapse = (value: string) => value.trim().replace(/\s+/g, " ");

export const variantColorSchema = z
  .string({ required_error: "رنگ الزامی است" })
  .transform(collapse)
  .pipe(z.string().min(1, "رنگ الزامی است").max(40, "رنگ نباید بیشتر از ۴۰ کاراکتر باشد"));

/** سایز لاتین (xl) به حروف بزرگ (XL) نرمال می‌شود؛ سایز فارسی/عددی دست‌نخورده می‌ماند */
export const variantSizeSchema = z
  .string({ required_error: "سایز الزامی است" })
  .transform((value) => collapse(value).toUpperCase())
  .pipe(z.string().min(1, "سایز الزامی است").max(20, "سایز نباید بیشتر از ۲۰ کاراکتر باشد"));

/** کلید مقایسه ترکیب رنگ/سایز (بدون حساس‌بودن به حروف) برای تشخیص تنوع تکراری */
export function variantCombinationKey(variant: { size: string; color: string }): string {
  return `${collapse(variant.size).toLowerCase()}::${collapse(variant.color).toLowerCase()}`;
}

export const createVariantSchema = z.object({
  size: variantSizeSchema,
  color: variantColorSchema,
  /** اختیاری: اگر ارسال نشود، سیستم SKU یکتا می‌سازد */
  sku: variantSkuSchema.optional(),
  /** null/نبود = قیمت پایه محصول */
  price: priceSchema.nullish(),
  /** فقط موجودی «اولیه» (ثبت در دفتر کل انبار)؛ تغییر بعدی موجودی در فاز مدیریت موجودی انجام می‌شود */
  stock: z.number().int("موجودی باید عدد صحیح باشد").min(0, "موجودی نمی‌تواند منفی باشد").max(1_000_000).default(0),
});
export type CreateVariantInput = z.infer<typeof createVariantSchema>;

/** موجودی عمداً قابل ویرایش نیست (منبع حقیقت موجودی = دفتر کل انبار، فاز بعد) */
export const updateVariantSchema = z
  .object({
    size: variantSizeSchema.optional(),
    color: variantColorSchema.optional(),
    sku: variantSkuSchema.optional(),
    price: priceSchema.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "حداقل یک فیلد برای ویرایش لازم است" });
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export const variantParamsSchema = z.object({
  productId: z.string().uuid("شناسه معتبر نیست"),
  variantId: z.string().uuid("شناسه معتبر نیست"),
});

export const variantProductParamsSchema = z.object({
  productId: z.string().uuid("شناسه معتبر نیست"),
});

/**
 * ذخیره یک‌جای Variant Builder. فهرست ارسالی = مجموعه کامل تنوع‌های فعال مدنظر:
 * با id → ویرایش، بدون id → ساخت، تنوع فعالِ غایب → آرشیو.
 */
export const syncVariantsSchema = z
  .object({
    variants: z
      .array(
        createVariantSchema.extend({
          id: z.string().uuid("شناسه معتبر نیست").optional(),
        }),
      )
      .max(50, "حداکثر ۵۰ تنوع مجاز است"),
  })
  .superRefine((data, ctx) => {
    const combos = new Set<string>();
    const skus = new Set<string>();
    data.variants.forEach((variant, index) => {
      const key = variantCombinationKey(variant);
      if (combos.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants", index, "color"],
          message: "این ترکیب رنگ و سایز تکراری است",
        });
      }
      combos.add(key);
      if (variant.sku) {
        if (skus.has(variant.sku)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["variants", index, "sku"],
            message: "این SKU تکراری است",
          });
        }
        skus.add(variant.sku);
      }
    });
  });
export type SyncVariantsInput = z.infer<typeof syncVariantsSchema>;
