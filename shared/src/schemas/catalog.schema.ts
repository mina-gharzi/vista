import { z } from "zod";
import { slugSchema } from "./category.schema";

export const productSortOptionSchema = z.enum(["newest", "price_asc", "price_desc", "discounted"]);

export const catalogQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(24),
    /** slug دسته‌بندی — محصولات آن دسته و همه زیردسته‌هایش نمایش داده می‌شوند */
    category: slugSchema.optional(),
    search: z.string().trim().min(1, "عبارت جستجو نمی‌تواند خالی باشد").max(100).optional(),
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
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

export const productSlugParamSchema = z.object({ slug: slugSchema });
