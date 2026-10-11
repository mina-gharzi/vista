import { Router } from "express";
import {
  sellerOrderParamsSchema,
  sellerOrdersQuerySchema,
  updateSellerOrderStatusSchema,
} from "@vista/shared";
import { requireAuth } from "../../middlewares/requireAuth";
import { validate } from "../../middlewares/validate";
import type { SellerOrdersController } from "./sellerOrders.controller";

/** روی /api/seller/orders سوار می‌شود. مجوز = APPROVED بودن Seller در دیتابیس (guard) */
export function createSellerOrdersRouter(controller: SellerOrdersController): Router {
  const router = Router();

  router.use(requireAuth, controller.guard);

  // /summary باید قبل از /:sellerOrderId ثبت شود
  router.get("/summary", controller.overview);
  router.get("/", validate(sellerOrdersQuerySchema, "query"), controller.list);
  router.get("/:sellerOrderId", validate(sellerOrderParamsSchema, "params"), controller.detail);
  router.patch(
    "/:sellerOrderId/status",
    validate(sellerOrderParamsSchema, "params"),
    validate(updateSellerOrderStatusSchema, "body"),
    controller.updateStatus,
  );
  // عمداً هیچ مسیر دیگری (ویرایش مبلغ، پرداخت، لغو، حذف) وجود ندارد

  return router;
}
