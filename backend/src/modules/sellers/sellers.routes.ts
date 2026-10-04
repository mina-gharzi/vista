import { Router } from "express";
import { createRateLimiter } from "../../middlewares/rateLimit";
import { requireAuth } from "../../middlewares/requireAuth";
import { validate } from "../../middlewares/validate";
import type { SellersController } from "./sellers.controller";
import { applySellerSchema } from "./sellers.validator";

export function createSellersRouter(controller: SellersController): Router {
  const router = Router();
  // عمداً requireRole نداریم: مشتری عادی (CUSTOMER) باید بتواند درخواست بدهد و وضعیتش را ببیند.
  // مجوزهای دقیق‌تر (نقش/وضعیت فعلی در DB) در Service اعمال می‌شوند.
  router.use(requireAuth);

  const applyLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 10 });

  router.post("/apply", applyLimiter, validate(applySellerSchema, "body"), controller.apply);
  router.get("/application/status", controller.getApplicationStatus);

  return router;
}
