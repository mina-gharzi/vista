import { Router } from "express";
import {
  createProductSchema,
  productIdParamSchema,
  sellerProductsQuerySchema,
  updateProductSchema,
  updateProductStatusSchema,
} from "@vista/shared";
import { requireAuth } from "../../middlewares/requireAuth";
import { validate } from "../../middlewares/validate";
import type { ProductsController } from "./products.controller";

export function createProductsRouter(controller: ProductsController): Router {
  const router = Router();

  // همه مسیرها مخصوص فروشنده‌اند و فقط محصولات خودش را می‌بینند/می‌سازند (بخش ۱۷ پرامپت مادر)
  // اختیار فروشنده بودن از DB (Seller.status === APPROVED) در سرویس بررسی می‌شود نه از نقش داخل توکن
  // (توکن بعد از تأیید ادمین تا رفرش قدیمی می‌ماند)
  router.use(requireAuth, controller.guard);

  router.get("/", validate(sellerProductsQuerySchema, "query"), controller.list);
  router.post("/", validate(createProductSchema, "body"), controller.create);
  router.get("/:id", validate(productIdParamSchema, "params"), controller.getOne);
  router.patch(
    "/:id",
    validate(productIdParamSchema, "params"),
    validate(updateProductSchema, "body"),
    controller.update,
  );
  router.patch(
    "/:id/status",
    validate(productIdParamSchema, "params"),
    validate(updateProductStatusSchema, "body"),
    controller.updateStatus,
  );

  router.delete("/:id", validate(productIdParamSchema, "params"), controller.archive);

  return router;
}
