import { z } from "zod";
import { slugSchema } from "./category.schema";
import { normalizeSearchText } from "../utils/searchText";

export const productSortOptionSchema = z.enum(["newest", "price_asc", "price_desc", "discounted"]);

/** Int پایگاه‌داده (۳۲ بیتی)؛ قیمتِ بزرگ‌تر هرگز در دیتابیس وجود ندارد */
export const MAX_FILTER_PRICE = 2_000_000_000;

const boolFlag = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

const variantValue = z.string().trim().min(1).max(30);

export const catalogQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(24),
    /** slug دسته‌بندی — محصولات آن دسته و همه زیردسته‌هایش نمایش داده می‌شوند */
    category: slugSchema.optional(),
    /**
     * جستجو در عنوان، توضیحات و نام دسته. ورودی نرمال‌سازی می‌شود (ی/ک، ارقام، نیم‌فاصله، wildcardها)؛
     * متن خالی/فقط‌فاصله یعنی «بدون جستجو» (خطا نیست). سقف ۱۰۰ نویسه.
     */
    search: z
      .string()
      .max(100, "عبارت جستجو حداکثر ۱۰۰ نویسه است")
      .transform((value) => normalizeSearchText(value) || undefined)
      .optional(),
    minPrice: z.coerce.number().int().min(0).max(MAX_FILTER_PRICE).optional(),
    maxPrice: z.coerce.number().int().min(0).max(MAX_FILTER_PRICE).optional(),
    /** slug فروشگاه (Seller.storeSlug) */
    seller: slugSchema.optional(),
    /** رنگ/سایز یک تنوعِ «فعال» (تطبیق کامل، بدون حساسیت به حروف) */
    color: variantValue.optional(),
    size: variantValue.optional(),
    /** فقط محصولاتی که حداقل یک تنوع فعال با موجودی > ۰ دارند */
    inStock: boolFlag,
    /** فقط محصولات دارای compareAtPrice (تخفیف معتبر) */
    discounted: boolFlag,
    /**
     * newest | price_asc | price_desc | discounted (سازگاری با قرارداد قبلی: تخفیف‌دارها، جدیدترین اول).
     * «relevance» و «پرفروش» عمداً نیست: معیار قابل‌اعتمادی برای آن‌ها وجود ندارد.
     */
    sort: productSortOptionSchema.default("newest"),
  })
  .refine(
    (data) =>
      data.minPrice === undefined || data.maxPrice === undefined || data.minPrice <= data.maxPrice,
    {
      message: "حداقل قیمت باید کمتر یا مساوی حداکثر قیمت باشد",
      path: ["minPrice"],
    },
  );

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

/** گزینه‌های فیلتر در محدودهٔ دسته/جستجوی فعلی */
export const catalogFilterOptionsQuerySchema = z.object({
  category: slugSchema.optional(),
  search: catalogQuerySchema.innerType().shape.search,
});
export type CatalogFilterOptionsQuery = z.infer<typeof catalogFilterOptionsQuerySchema>;

export const productSlugParamSchema = z.object({ slug: slugSchema });
