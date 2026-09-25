import { z } from "zod";

/** فرمت Slug: حروف کوچک لاتین، عدد و خط تیره؛ بدون خط تیره در ابتدا/انتها یا پشت‌سرهم */
export const slugSchema = z
  .string()
  .min(1, "شناسه (slug) الزامی است")
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "شناسه فقط می‌تواند شامل حروف کوچک لاتین، عدد و خط تیره باشد");

export const categorySlugParamSchema = z.object({
  slug: slugSchema,
});

export type CategorySlugParam = z.infer<typeof categorySlugParamSchema>;
