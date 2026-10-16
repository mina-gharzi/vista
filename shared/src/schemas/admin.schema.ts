import { z } from "zod";
import { SELLER_TARGETS_REQUIRING_REASON, type SellerAdminTarget } from "../types/admin";
import { slugSchema } from "./category.schema";

const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(50).default(20);
const search = z
  .string()
  .trim()
  .max(100)
  .transform((value) => (value === "" ? undefined : value))
  .optional();
const uuid = (message: string) => z.string().uuid(message);

export const adminIdParamSchema = z.object({ id: uuid("شناسه معتبر نیست") });

const reasonSchema = z
  .string({ invalid_type_error: "دلیل معتبر نیست" })
  .trim()
  .min(3, "دلیل باید حداقل ۳ کاراکتر باشد")
  .max(500, "دلیل نباید بیشتر از ۵۰۰ کاراکتر باشد");

// ───────── فروشندگان ─────────
export const adminSellersQuerySchema = z.object({
  page,
  limit,
  q: search,
  status: z.enum(["PENDING", "APPROVED", "SUSPENDED", "REJECTED"], {
    errorMap: () => ({ message: "وضعیت فروشنده معتبر نیست" }),
  }).optional(),
});
export type AdminSellersQuery = z.infer<typeof adminSellersQuerySchema>;

export const adminSellerStatusSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED", "SUSPENDED"], {
      errorMap: () => ({ message: "وضعیت مقصد معتبر نیست" }),
    }),
    reason: reasonSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const needsReason = SELLER_TARGETS_REQUIRING_REASON.includes(data.status as SellerAdminTarget);
    if (needsReason && !data.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "برای رد یا تعلیق، ثبت دلیل الزامی است",
      });
    }
  });
export type AdminSellerStatusInput = z.infer<typeof adminSellerStatusSchema>;

// ───────── محصولات ─────────
export const adminProductsQuerySchema = z.object({
  page,
  limit,
  q: search,
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"], {
    errorMap: () => ({ message: "وضعیت محصول معتبر نیست" }),
  }).optional(),
  categoryId: uuid("دسته‌بندی معتبر نیست").optional(),
  sellerId: uuid("فروشنده معتبر نیست").optional(),
  /** فقط محصولات فروشنده‌های غیرتأییدشده (مثلاً تعلیق‌شده) */
  blockedSellers: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});
export type AdminProductsQuery = z.infer<typeof adminProductsQuerySchema>;

export const adminProductStatusSchema = z
  .object({
    status: z.enum(["DRAFT", "ARCHIVED"], { errorMap: () => ({ message: "وضعیت مقصد معتبر نیست" }) }),
    reason: reasonSchema,
  })
  .strict();
export type AdminProductStatusInput = z.infer<typeof adminProductStatusSchema>;

// ───────── دسته‌بندی ─────────
const categoryName = z
  .string({ required_error: "نام الزامی است" })
  .trim()
  .min(1, "نام الزامی است")
  .max(80, "نام نباید بیشتر از ۸۰ کاراکتر باشد");

const imageUrl = z
  .string()
  .trim()
  .url("آدرس تصویر معتبر نیست")
  .max(500)
  .refine((value) => /^https?:\/\//i.test(value), "آدرس تصویر باید با http یا https شروع شود");

export const adminCategoriesQuerySchema = z.object({
  q: search,
  sort: z.enum(["order", "name", "products"]).default("order"),
});
export type AdminCategoriesQuery = z.infer<typeof adminCategoriesQuerySchema>;

export const createCategorySchema = z
  .object({
    name: categoryName,
    slug: slugSchema,
    parentId: uuid("دستهٔ والد معتبر نیست").nullable().optional(),
    imageUrl: imageUrl.nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int("ترتیب باید عدد صحیح باشد").min(0).max(10_000).optional(),
  })
  .strict();
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: categoryName.optional(),
    slug: slugSchema.optional(),
    parentId: uuid("دستهٔ والد معتبر نیست").nullable().optional(),
    imageUrl: imageUrl.nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int("ترتیب باید عدد صحیح باشد").min(0).max(10_000).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: "حداقل یک فیلد برای ویرایش لازم است" });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ───────── سفارش‌ها ─────────
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ باید به شکل YYYY-MM-DD باشد");

export const adminOrdersQuerySchema = z
  .object({
    page,
    limit,
    q: search,
    status: z.enum(["PENDING", "PAID", "CANCELLED", "REFUNDED"], {
      errorMap: () => ({ message: "وضعیت سفارش معتبر نیست" }),
    }).optional(),
    from: dateOnly.optional(),
    to: dateOnly.optional(),
  })
  .refine((d) => !d.from || !d.to || d.from <= d.to, {
    path: ["to"],
    message: "تاریخ پایان نباید قبل از تاریخ شروع باشد",
  });
export type AdminOrdersQuery = z.infer<typeof adminOrdersQuerySchema>;
