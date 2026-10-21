import type { RequestHandler } from "express";
import type { CatalogFilterOptionsQuery, CatalogQuery } from "@vista/shared";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import type { CatalogService } from "./catalog.service";

export interface CatalogController {
  list: RequestHandler;
  getBySlug: RequestHandler;
  filterOptions: RequestHandler;
}

export function createCatalogController(service: CatalogService): CatalogController {
  return {
    // req.query قبلاً توسط validate(catalogQuerySchema, "query") Parse و پیش‌فرض‌گذاری شده است
    list: asyncHandler(async (req, res) => {
      sendSuccess(res, await service.list(req.query as unknown as CatalogQuery));
    }),

    filterOptions: asyncHandler(async (req, res) => {
      sendSuccess(res, await service.filterOptions(req.query as unknown as CatalogFilterOptionsQuery));
    }),

    getBySlug: asyncHandler(async (req, res) => {
      sendSuccess(res, await service.getBySlug(req.params.slug as string));
    }),
  };
}
