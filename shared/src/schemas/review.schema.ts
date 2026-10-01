import { z } from "zod";

export const reviewInputSchema = z.object({
  rating: z.number().int("امتیاز باید عدد صحیح باشد").min(1, "امتیاز باید بین ۱ تا ۵ باشد").max(5),
  comment: z.string().trim().max(1000, "نظر نباید بیشتر از ۱۰۰۰ کاراکتر باشد").optional(),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const updateReviewSchema = reviewInputSchema
  .partial()
  .refine((data) => data.rating !== undefined || data.comment !== undefined, {
    message: "حداقل یک فیلد برای ویرایش لازم است",
  });
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

export const reviewIdParamSchema = z.object({ id: z.string().uuid("شناسه ریویو معتبر نیست") });
export const reviewProductIdParamSchema = z.object({
  productId: z.string().uuid("شناسه محصول معتبر نیست"),
});

export const reviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type ReviewsQuery = z.infer<typeof reviewsQuerySchema>;
