import type { ProductReviewsResult, ReviewInput, UpdateReviewInput } from "@vista/shared";
import { apiRequest } from "./client";

export const reviewsApi = {
  /** عمومی است؛ auth اختیاری فقط برای isMine فرستاده می‌شود (اگر کاربر وارد باشد) */
  listForProduct: (productId: string, page = 1) =>
    apiRequest<ProductReviewsResult>(`/products/${productId}/reviews?page=${page}`, {
      auth: true,
    }),
  create: (productId: string, input: ReviewInput) =>
    apiRequest(`/products/${productId}/reviews`, { method: "POST", auth: true, body: input }),
  update: (reviewId: string, input: UpdateReviewInput) =>
    apiRequest(`/reviews/${reviewId}`, { method: "PATCH", auth: true, body: input }),
  remove: (reviewId: string) =>
    apiRequest(`/reviews/${reviewId}`, { method: "DELETE", auth: true }),
};
