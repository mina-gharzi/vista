import type { RequestHandler } from "express";
import type { CatalogQuery } from "@vista/shared";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import type { CatalogService } from "./catalog.service";

export interface CatalogController {
  list: RequestHandler;
  getBySlug: RequestHandler;
}

export function createCatalogController(service: CatalogService): CatalogController {
  return {
    // req.query قبلاً توسط validate(catalogQuerySchema, "query") Parse و پیش‌فرض‌گذاری شده است
    list: asyncHandler(async (req, res) => {
      sendSuccess(res, await service.list(req.query as unknown as CatalogQuery));
    }),

    getBySlug: asyncHandler(async (req, res) => {
      sendSuccess(res, await service.getBySlug(req.params.slug as string));
    }),
  };
}
