import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import type { CategoriesService } from "./categories.service";

export interface CategoriesController {
  getTree: RequestHandler;
  getBySlug: RequestHandler;
}

export function createCategoriesController(service: CategoriesService): CategoriesController {
  return {
    getTree: asyncHandler(async (_req, res) => {
      sendSuccess(res, await service.getTree());
    }),

    // req.params قبلاً توسط validate(categorySlugParamSchema, "params") بررسی شده است
    getBySlug: asyncHandler(async (req, res) => {
      sendSuccess(res, await service.getBySlug(req.params.slug as string));
    }),
  };
}
