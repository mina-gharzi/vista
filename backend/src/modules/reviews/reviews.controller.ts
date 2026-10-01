import type { RequestHandler } from "express";
import type { ReviewInput, ReviewsQuery, UpdateReviewInput } from "@vista/shared";
import { getAuth } from "../../middlewares/requireAuth";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import type { ReviewsService } from "./reviews.service";

export interface ReviewsController {
  list: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
}

export function createReviewsController(service: ReviewsService): ReviewsController {
  return {
    // req.auth ممکن است پر نباشد (optionalAuth) — یعنی بازدیدکننده مهمان است
    list: asyncHandler(async (req, res) => {
      const result = await service.listForProduct(
        req.params.productId as string,
        req.query as unknown as ReviewsQuery,
        req.auth?.userId,
      );
      sendSuccess(res, result);
    }),

    create: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      const { rating, comment } = req.body as ReviewInput;
      const review = await service.create(userId, req.params.productId as string, rating, comment);
      sendSuccess(res, review, 201);
    }),

    update: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      const review = await service.update(
        userId,
        req.params.id as string,
        req.body as UpdateReviewInput,
      );
      sendSuccess(res, review);
    }),

    remove: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      await service.remove(userId, req.params.id as string);
      sendSuccess(res, null);
    }),
  };
}
