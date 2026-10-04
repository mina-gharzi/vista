import { z } from "zod";

/** فقط حروف کوچک لاتین، عدد و خط تیره؛ بدون خط تیره ابتدا/انتها یا پشت‌سرهم (مناسب URL) */
export const STORE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * درخواست فروشندگی. userId، role و status عمداً در Schema نیستند: هویت از توکن می‌آید و
 * وضعیت همیشه PENDING است؛ فیلدهای اضافه در Body توسط Zod حذف می‌شوند (Mass Assignment).
 */
export const applySellerSchema = z.object({
  storeName: z
    .string({ required_error: "نام فروشگاه الزامی است." })
    .trim()
    .min(1, "نام فروشگاه الزامی است.")
    .min(3, "نام فروشگاه باید حداقل ۳ کاراکتر باشد.")
    .max(60, "نام فروشگاه نباید بیشتر از ۶۰ کاراکتر باشد."),
  storeSlug: z
    .string({ required_error: "شناسه فروشگاه الزامی است." })
    .trim()
    .toLowerCase()
    .min(1, "شناسه فروشگاه الزامی است.")
    .min(3, "شناسه فروشگاه باید حداقل ۳ کاراکتر باشد.")
    .max(40, "شناسه فروشگاه نباید بیشتر از ۴۰ کاراکتر باشد.")
    .regex(
      STORE_SLUG_PATTERN,
      "شناسه فروشگاه فقط می‌تواند شامل حروف انگلیسی، عدد و خط تیره (بین کلمات) باشد.",
    ),
  // رشته خالی یعنی «بدون توضیحات»
  description: z
    .string()
    .trim()
    .max(500, "توضیحات نباید بیشتر از ۵۰۰ کاراکتر باشد.")
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});

export type ApplySellerInput = z.infer<typeof applySellerSchema>;
