import { Router } from "express";
import {
  createVariantSchema,
  syncVariantsSchema,
  updateVariantSchema,
  variantParamsSchema,
  variantProductParamsSchema,
} from "@vista/shared";
import { requireAuth } from "../../middlewares/requireAuth";
import { validate } from "../../middlewares/validate";
import type { VariantsController } from "./variants.controller";

/** روی /api/seller/products/:productId/variants سوار می‌شود */
export function createVariantsRouter(controller: VariantsController): Router {
  const router = Router({ mergeParams: true });

  router.use(requireAuth, controller.guard);

  router.get("/", validate(variantProductParamsSchema, "params"), controller.list);
  router.post(
    "/",
    validate(variantProductParamsSchema, "params"),
    validate(createVariantSchema, "body"),
    controller.create,
  );
  // ذخیره اتمیک Variant Builder (مجموعه کامل تنوع‌های فعال)
  router.put(
    "/",
    validate(variantProductParamsSchema, "params"),
    validate(syncVariantsSchema, "body"),
    controller.sync,
  );
  router.patch(
    "/:variantId",
    validate(variantParamsSchema, "params"),
    validate(updateVariantSchema, "body"),
    controller.update,
  );
  router.delete("/:variantId", validate(variantParamsSchema, "params"), controller.archive);

  return router;
}
