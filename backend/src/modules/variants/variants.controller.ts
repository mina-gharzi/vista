import type { RequestHandler } from "express";
import type { CreateVariantInput, SyncVariantsInput, UpdateVariantInput } from "@vista/shared";
import { getAuth } from "../../middlewares/requireAuth";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import type { VariantsService } from "./variants.service";

export interface VariantsController {
  guard: RequestHandler;
  list: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  archive: RequestHandler;
  sync: RequestHandler;
}

export function createVariantsController(service: VariantsService): VariantsController {
  return {
    // گارد دسترسی قبل از اعتبارسنجی Body: غیرفروشنده حتی پیام خطای فیلدها را نمی‌بیند
    guard: (req, _res, next) => {
      service.assertCanManage(getAuth(req).userId).then(() => next(), next);
    },

    list: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      sendSuccess(res, await service.list(userId, req.params.productId as string));
    }),

    create: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      const created = await service.create(
        userId,
        req.params.productId as string,
        req.body as CreateVariantInput,
      );
      sendSuccess(res, created, 201);
    }),

    update: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      const updated = await service.update(
        userId,
        req.params.productId as string,
        req.params.variantId as string,
        req.body as UpdateVariantInput,
      );
      sendSuccess(res, updated);
    }),

    archive: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      sendSuccess(
        res,
        await service.archive(userId, req.params.productId as string, req.params.variantId as string),
      );
    }),

    sync: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      sendSuccess(
        res,
        await service.sync(userId, req.params.productId as string, req.body as SyncVariantsInput),
      );
    }),
  };
}
