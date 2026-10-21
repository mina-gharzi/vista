import { Router, type RequestHandler } from "express";
import {
  adminCouponsQuerySchema,
  couponIdParamSchema,
  couponStatusSchema,
  createCouponSchema,
  updateCouponSchema,
} from "@vista/shared";
import { validate } from "../../middlewares/validate";
import type { AdminCouponsController } from "./adminCoupons.controller";

/**
 * guard (احراز هویت + نقش ADMIN از «دیتابیس») قبل از هر validate اجرا می‌شود؛ غیرادمین حتی پیام خطای
 * اعتبارسنجی هم نمی‌بیند. روی /api/admin/coupons و «قبل از» /api/admin سوار می‌شود.
 */
export function createAdminCouponsRouter(
  controller: AdminCouponsController,
  guard: RequestHandler[],
): Router {
  const router = Router();
  router.use(...guard);
  const idParam = validate(couponIdParamSchema, "params");

  router.get("/", validate(adminCouponsQuerySchema, "query"), controller.list);
  router.post("/", validate(createCouponSchema, "body"), controller.create);
  router.get("/:couponId", idParam, controller.getOne);
  router.patch("/:couponId", idParam, validate(updateCouponSchema, "body"), controller.update);
  router.patch("/:couponId/status", idParam, validate(couponStatusSchema, "body"), controller.setStatus);

  return router;
}
