import { randomUUID } from "node:crypto";
import type { ReviewRow, ReviewsRepository } from "../../src/modules/reviews/reviews.repository";

interface StoredReview extends ReviewRow {
  productId: string;
}

/** پیاده‌سازی درون‌حافظه‌ای ReviewsRepository برای تست بدون Database واقعی. */
export class FakeReviewsRepository implements ReviewsRepository {
  private readonly reviews = new Map<string, StoredReview>();
  private readonly purchases = new Set<string>(); // `${userId}::${productId}`

  markPurchased(userId: string, productId: string): void {
    this.purchases.add(`${userId}::${productId}`);
  }

  async hasPurchased(userId: string, productId: string) {
    return this.purchases.has(`${userId}::${productId}`);
  }

  async findByUserAndProduct(userId: string, productId: string) {
    const found = [...this.reviews.values()].find(
      (r) => r.userId === userId && r.productId === productId,
    );
    return found ? { id: found.id } : null;
  }

  async findOwnedById(userId: string, reviewId: string) {
    const review = this.reviews.get(reviewId);
    return review && review.userId === userId ? review : null;
  }

  async create(userId: string, productId: string, rating: number, comment: string | null) {
    const now = new Date();
    const review: StoredReview = {
      id: randomUUID(),
      userId,
      productId,
      rating,
      comment,
      createdAt: now,
      updatedAt: now,
      user: { fullName: "کاربر آزمایشی" },
    };
    this.reviews.set(review.id, review);
    return review;
  }

  async update(
    reviewId: string,
    data: { rating?: number | undefined; comment?: string | undefined },
  ) {
    const review = this.reviews.get(reviewId);
    if (!review) throw new Error("test setup error: review not found");
    const updated: StoredReview = {
      ...review,
      ...(data.rating !== undefined ? { rating: data.rating } : {}),
      ...(data.comment !== undefined ? { comment: data.comment } : {}),
      updatedAt: new Date(),
    };
    this.reviews.set(reviewId, updated);
    return updated;
  }

  async remove(reviewId: string) {
    this.reviews.delete(reviewId);
  }

  async findManyForProduct(productId: string, params: { page: number; limit: number }) {
    const all = [...this.reviews.values()]
      .filter((r) => r.productId === productId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (params.page - 1) * params.limit;
    return { items: all.slice(start, start + params.limit), total: all.length };
  }

  async getAggregate(productId: string) {
    const all = [...this.reviews.values()].filter((r) => r.productId === productId);
    if (all.length === 0) return { average: 0, count: 0 };
    return { average: all.reduce((sum, r) => sum + r.rating, 0) / all.length, count: all.length };
  }
}
