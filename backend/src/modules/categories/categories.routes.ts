import { Router } from "express";
import { categorySlugParamSchema } from "@vista/shared";
import { validate } from "../../middlewares/validate";
import type { CategoriesController } from "./categories.controller";

export function createCategoriesRouter(controller: CategoriesController): Router {
  const router = Router();

  // هر دو Endpoint عمومی هستند (بدون نیاز به ورود)؛ Rate Limit عمومی app.ts کافی است
  router.get("/", controller.getTree);
  router.get("/:slug", validate(categorySlugParamSchema, "params"), controller.getBySlug);

  return router;
}
