import { Router, type RequestHandler } from "express";
import { validateCouponSchema } from "@vista/shared";
import { requireAuth } from "../../middlewares/requireAuth";
import { validate } from "../../middlewares/validate";
import type { CouponsController } from "./coupons.controller";

/**
 * `limiter` (Rate Limit) حدس‌زدن کد کوپن را کند می‌کند؛ در تست‌ها تزریق نمی‌شود/غیرفعال است.
 * این مسیر فقط «پیش‌نمایش» است و هرگز کوپن را مصرف نمی‌کند.
 */
export function createCouponsRouter(controller: CouponsController, limiter?: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);
  router.post(
    "/validate",
    ...(limiter ? [limiter] : []),
    validate(validateCouponSchema, "body"),
    controller.validate,
  );
  return router;
}
