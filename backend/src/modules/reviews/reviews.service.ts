import type { ProductReviewsResult, ReviewSummary } from "@vista/shared";
import { AuthorizationError, ConflictError, NotFoundError } from "../../errors/AppError";
import type { ReviewsRepository } from "./reviews.repository";
import { toReviewSummary } from "./reviews.mapper";

export interface ReviewsService {
  listForProduct(
    productId: string,
    params: { page: number; limit: number },
    viewerUserId: string | undefined,
  ): Promise<ProductReviewsResult>;
  create(
    userId: string,
    productId: string,
    rating: number,
    comment: string | undefined,
  ): Promise<ReviewSummary>;
  update(
    userId: string,
    reviewId: string,
    data: { rating?: number | undefined; comment?: string | undefined },
  ): Promise<ReviewSummary>;
  remove(userId: string, reviewId: string): Promise<void>;
}

export function createReviewsService(repository: ReviewsRepository): ReviewsService {
  return {
    async listForProduct(productId, params, viewerUserId) {
      const [{ items }, aggregate] = await Promise.all([
        repository.findManyForProduct(productId, params),
        repository.getAggregate(productId),
      ]);
      // count همان تعداد کل ریویوهاست (نه فقط همین صفحه)؛ Frontend صفحه‌بندی را با همان page/limit ارسالی مدیریت می‌کند
      return {
        reviews: items.map((row) => toReviewSummary(row, viewerUserId)),
        average: Math.round(aggregate.average * 10) / 10,
        count: aggregate.count,
      };
    },

    async create(userId, productId, rating, comment) {
      if (!(await repository.hasPurchased(userId, productId))) {
        throw new AuthorizationError("فقط خریداران این محصول می‌توانند نظر ثبت کنند");
      }
      if (await repository.findByUserAndProduct(userId, productId)) {
        throw new ConflictError("شما قبلاً برای این محصول نظر ثبت کرده‌اید");
      }

      const row = await repository.create(userId, productId, rating, comment ?? null);
      return toReviewSummary(row, userId);
    },

    async update(userId, reviewId, data) {
      const existing = await repository.findOwnedById(userId, reviewId);
      if (!existing) {
        throw new NotFoundError("نظر یافت نشد");
      }
      const row = await repository.update(reviewId, data);
      return toReviewSummary(row, userId);
    },

    async remove(userId, reviewId) {
      const existing = await repository.findOwnedById(userId, reviewId);
      if (!existing) {
        throw new NotFoundError("نظر یافت نشد");
      }
      await repository.remove(reviewId);
    },
  };
}
