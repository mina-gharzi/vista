import { z } from "zod";

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

export const productImageInputSchema = z.object({
  url: z.string().url("آدرس تصویر معتبر نیست"),
  altText: z.string().trim().max(200).optional(),
});

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
    description: z.string().trim().min(10).max(5000).optional(),
    basePrice: priceSchema.optional(),
    compareAtPrice: priceSchema.nullable().optional(),
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
});

export type SellerProductsQuery = z.infer<typeof sellerProductsQuerySchema>;
