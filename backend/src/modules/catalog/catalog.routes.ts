import { Router } from "express";
import { catalogFilterOptionsQuerySchema, catalogQuerySchema, productSlugParamSchema } from "@vista/shared";
import { validate } from "../../middlewares/validate";
import type { CatalogController } from "./catalog.controller";

export function createCatalogRouter(controller: CatalogController): Router {
  const router = Router();

  // هر دو Endpoint عمومی‌اند (بدون ورود)؛ فقط محصولات PUBLISHED نمایش داده می‌شوند
  router.get("/", validate(catalogQuerySchema, "query"), controller.list);
  // دو بخشی است و با «/:slug» تداخل ندارد
  router.get("/filters/options", validate(catalogFilterOptionsQuerySchema, "query"), controller.filterOptions);
  router.get("/:slug", validate(productSlugParamSchema, "params"), controller.getBySlug);

  return router;
}
