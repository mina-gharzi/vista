import { Router } from "express";
import {
  reviewIdParamSchema,
  reviewInputSchema,
  reviewProductIdParamSchema,
  reviewsQuerySchema,
  updateReviewSchema,
} from "@vista/shared";
import { optionalAuth, requireAuth } from "../../middlewares/requireAuth";
import { validate } from "../../middlewares/validate";
import type { ReviewsController } from "./reviews.controller";

/** تودرتوی محصول: GET عمومی (optionalAuth برای isMine)، POST نیازمند ورود */
export function createProductReviewsRouter(controller: ReviewsController): Router {
  const router = Router({ mergeParams: true });
  router.get(
    "/",
    validate(reviewProductIdParamSchema, "params"),
    validate(reviewsQuerySchema, "query"),
    optionalAuth,
    controller.list,
  );
  router.post(
    "/",
    requireAuth,
    validate(reviewProductIdParamSchema, "params"),
    validate(reviewInputSchema, "body"),
    controller.create,
  );
  return router;
}

/** مستقل: ویرایش/حذف فقط با شناسه خودِ ریویو، فقط برای مالک */
export function createReviewsRouter(controller: ReviewsController): Router {
  const router = Router();
  router.use(requireAuth);
  router.patch(
    "/:id",
    validate(reviewIdParamSchema, "params"),
    validate(updateReviewSchema, "body"),
    controller.update,
  );
  router.delete("/:id", validate(reviewIdParamSchema, "params"), controller.remove);
  return router;
}
