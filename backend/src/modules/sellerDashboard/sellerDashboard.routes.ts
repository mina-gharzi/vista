import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import type { SellerDashboardController } from "./sellerDashboard.controller";

export function createSellerDashboardRouter(controller: SellerDashboardController): Router {
  const router = Router();
  // requireRole نداریم: مرجع دسترسی «وضعیت APPROVED در Database» است نه نقش داخل توکن (که ممکن است کهنه باشد).
  router.get("/", requireAuth, controller.get);
  return router;
}
