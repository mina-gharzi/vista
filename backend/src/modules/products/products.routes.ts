import { Router } from "express";
import {
  createProductSchema,
  productIdParamSchema,
  sellerProductsQuerySchema,
  updateProductSchema,
  updateProductStatusSchema,
} from "@vista/shared";
import { requireAuth, requireRole } from "../../middlewares/requireAuth";
import { validate } from "../../middlewares/validate";
import type { ProductsController } from "./products.controller";

export function createProductsRouter(controller: ProductsController): Router {
  const router = Router();

  // همه مسیرها مخصوص فروشنده‌اند و فقط محصولات خودش را می‌بینند/می‌سازند (بخش ۱۷ پرامپت مادر)
  router.use(requireAuth, requireRole("SELLER"));

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

  return router;
}
