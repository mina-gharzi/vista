import { Router } from "express";
import {
  adjustStockSchema,
  inventoryMovementsQuerySchema,
  inventoryVariantParamsSchema,
  restockSchema,
  sellerInventoryQuerySchema,
} from "@vista/shared";
import { requireAuth } from "../../middlewares/requireAuth";
import { validate } from "../../middlewares/validate";
import type { InventoryController } from "./inventory.controller";

/** روی /api/seller/inventory سوار می‌شود. مجوز = APPROVED بودن Seller در دیتابیس (guard) */
export function createInventoryRouter(controller: InventoryController): Router {
  const router = Router();

  router.use(requireAuth, controller.guard);

  router.get("/", validate(sellerInventoryQuerySchema, "query"), controller.list);
  router.get(
    "/:variantId/movements",
    validate(inventoryVariantParamsSchema, "params"),
    validate(inventoryMovementsQuerySchema, "query"),
    controller.movements,
  );
  router.post(
    "/:variantId/restock",
    validate(inventoryVariantParamsSchema, "params"),
    validate(restockSchema, "body"),
    controller.restock,
  );
  router.post(
    "/:variantId/adjust",
    validate(inventoryVariantParamsSchema, "params"),
    validate(adjustStockSchema, "body"),
    controller.adjust,
  );
  // عمداً PUT/PATCH/DELETE وجود ندارد: حرکت‌های انبار هرگز ویرایش یا حذف نمی‌شوند

  return router;
}
