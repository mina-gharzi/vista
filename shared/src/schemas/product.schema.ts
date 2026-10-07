import { z } from "zod";
import { STORE_SLUG_PATTERN } from "./seller.schema";

const uuidSchema = z.string().uuid("شناسه معتبر نیست");

/** حداقل و حداکثر قیمت به تومان — جلوگیری از مقادیر بی‌معنی، نه یک محدودیت تجاری واقعی */
const priceSchema = z
  .number()
  .int("قیمت باید عدد صحیح باشد")
  .positive("قیمت باید مثبت باشد")
  .max(1_000_000_000);

export const productVariantInputSchema = z.object({
  size: z.string().trim().min(1, "سایز الزامی است").max(40),
  color: z.string().trim().min(1, "رنگ الزامی است").max(40),
  /** اگر خالی بماند، basePrice محصول ملاک قیمت این تنوع است */
  price: priceSchema.optional(),
  stock: z
    .number()
    .int("موجودی باید عدد صحیح باشد")
    .min(0, "موجودی نمی‌تواند منفی باشد")
    .max(1_000_000),
});

/** فقط http/https: آدرس‌هایی مثل javascript: یا data: به‌عنوان تصویر محصول پذیرفته نمی‌شوند */
const imageUrlSchema = z
  .string()
  .trim()
  .max(2000, "آدرس تصویر بیش از حد طولانی است")
  .url("آدرس تصویر معتبر نیست")
  .refine((value) => /^https?:\/\//i.test(value), "آدرس تصویر باید با http یا https شروع شود");

export const productImageInputSchema = z.object({
  url: imageUrlSchema,
  altText: z.string().trim().max(200).optional(),
});

/** Slug محصول: همان قالب Slug فروشگاه (STORE_SLUG_PATTERN) تا منطق Slug تکرار نشود. یکتایی در Backend/DB بررسی می‌شود. */
export const productSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "شناسه محصول باید حداقل ۳ کاراکتر باشد")
  .max(80, "شناسه محصول نباید بیشتر از ۸۰ کاراکتر باشد")
  .regex(
    STORE_SLUG_PATTERN,
    "شناسه محصول فقط می‌تواند شامل حروف انگلیسی، عدد و خط تیره (بین کلمات) باشد",
  );

function hasDuplicateVariant(variants: { size: string; color: string }[]): boolean {
  const seen = new Set<string>();
  for (const variant of variants) {
    const key = `${variant.size.trim().toLowerCase()}::${variant.color.trim().toLowerCase()}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

const priceConsistency = (
  data: { basePrice: number; compareAtPrice?: number | undefined },
  ctx: z.RefinementCtx,
) => {
  if (data.compareAtPrice !== undefined && data.compareAtPrice <= data.basePrice) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["compareAtPrice"],
      message: "قیمت قبل از تخفیف باید بیشتر از قیمت فعلی باشد",
    });
  }
};

export const createProductSchema = z
  .object({
    categoryId: uuidSchema,
    title: z.string().trim().min(3, "عنوان باید حداقل ۳ کاراکتر باشد").max(200),
    /** اختیاری: اگر ارسال نشود، Backend از روی عنوان یک Slug یکتا می‌سازد */
    slug: productSlugSchema.optional(),
    description: z.string().trim().min(10, "توضیحات باید حداقل ۱۰ کاراکتر باشد").max(5000),
    basePrice: priceSchema,
    compareAtPrice: priceSchema.optional(),
    images: z.array(productImageInputSchema).max(8, "حداکثر ۸ تصویر مجاز است").default([]),
    variants: z
      .array(productVariantInputSchema)
      .min(1, "حداقل یک تنوع (سایز/رنگ) لازم است")
      .max(50, "حداکثر ۵۰ تنوع مجاز است"),
  })
  .superRefine((data, ctx) => {
    priceConsistency(data, ctx);
    if (hasDuplicateVariant(data.variants)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["variants"],
        message: "ترکیب سایز و رنگ تکراری است",
      });
    }
  });

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    categoryId: uuidSchema.optional(),
    title: z.string().trim().min(3).max(200).optional(),
    /** تغییر Slug فقط برای محصول منتشرنشده مجاز است (Backend بررسی می‌کند) */
    slug: productSlugSchema.optional(),
    description: z.string().trim().min(10).max(5000).optional(),
    basePrice: priceSchema.optional(),
    compareAtPrice: priceSchema.nullable().optional(),
    /** کل فهرست تصاویر به ترتیب نمایش (اولین = تصویر اصلی)؛ جایگزین فهرست فعلی می‌شود */
    images: z.array(productImageInputSchema).max(8, "حداکثر ۸ تصویر مجاز است").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "حداقل یک فیلد برای ویرایش لازم است",
  });

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const updateProductStatusSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export type UpdateProductStatusInput = z.infer<typeof updateProductStatusSchema>;

export const productIdParamSchema = z.object({ id: uuidSchema });

export const sellerProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  /** جستجو در عنوان محصولات خود فروشنده */
  q: z
    .string()
    .trim()
    .max(100)
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});

export type SellerProductsQuery = z.infer<typeof sellerProductsQuerySchema>;
