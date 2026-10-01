import type { Prisma, PrismaClient } from "@prisma/client";

export interface ReviewRow {
  id: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: { fullName: string };
}

const REVIEW_SELECT = {
  id: true,
  userId: true,
  rating: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { fullName: true } },
} satisfies Prisma.ReviewSelect;

export interface ReviewsRepository {
  /** آیا این کاربر سفارش PAID شامل این محصول دارد؟ (جلوگیری از ریویوی جعلی) */
  hasPurchased(userId: string, productId: string): Promise<boolean>;
  findByUserAndProduct(userId: string, productId: string): Promise<{ id: string } | null>;
  findOwnedById(userId: string, reviewId: string): Promise<ReviewRow | null>;
  create(
    userId: string,
    productId: string,
    rating: number,
    comment: string | null,
  ): Promise<ReviewRow>;
  update(
    reviewId: string,
    data: { rating?: number | undefined; comment?: string | undefined },
  ): Promise<ReviewRow>;
  remove(reviewId: string): Promise<void>;
  findManyForProduct(
    productId: string,
    params: { page: number; limit: number },
  ): Promise<{ items: ReviewRow[]; total: number }>;
  getAggregate(productId: string): Promise<{ average: number; count: number }>;
}

export function createReviewsRepository(prisma: PrismaClient): ReviewsRepository {
  return {
    async hasPurchased(userId, productId) {
      const item = await prisma.orderItem.findFirst({
        where: {
          variant: { productId },
          sellerOrder: { order: { userId, status: "PAID" } },
        },
        select: { id: true },
      });
      return item !== null;
    },

    async findByUserAndProduct(userId, productId) {
      return prisma.review.findUnique({
        where: { userId_productId: { userId, productId } },
        select: { id: true },
      });
    },

    async findOwnedById(userId, reviewId) {
      return prisma.review.findFirst({ where: { id: reviewId, userId }, select: REVIEW_SELECT });
    },

    async create(userId, productId, rating, comment) {
      return prisma.review.create({
        data: { userId, productId, rating, comment },
        select: REVIEW_SELECT,
      });
    },

    async update(reviewId, data) {
      const patch: Prisma.ReviewUpdateInput = {};
      if (data.rating !== undefined) patch.rating = data.rating;
      if (data.comment !== undefined) patch.comment = data.comment;
      return prisma.review.update({ where: { id: reviewId }, data: patch, select: REVIEW_SELECT });
    },

    async remove(reviewId) {
      await prisma.review.delete({ where: { id: reviewId } });
    },

    async findManyForProduct(productId, { page, limit }) {
      const where: Prisma.ReviewWhereInput = { productId };
      const [items, total] = await Promise.all([
        prisma.review.findMany({
          where,
          select: REVIEW_SELECT,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.review.count({ where }),
      ]);
      return { items, total };
    },

    async getAggregate(productId) {
      const result = await prisma.review.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: true,
      });
      return { average: result._avg.rating ?? 0, count: result._count };
    },
  };
}
