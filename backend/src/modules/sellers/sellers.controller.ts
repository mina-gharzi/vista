import type { RequestHandler } from "express";
import type { ApplySellerInput } from "@vista/shared";
import { getAuth } from "../../middlewares/requireAuth";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import type { SellersService } from "./sellers.service";

export interface SellersController {
  apply: RequestHandler;
  getApplicationStatus: RequestHandler;
}

export function createSellersController(service: SellersService): SellersController {
  return {
    // هویت فقط از توکن (getAuth) می‌آید؛ req.body قبلاً با applySellerSchema پاک‌سازی شده و userId/role/status ندارد
    apply: asyncHandler(async (req, res) => {
      const input = req.body as ApplySellerInput;
      sendSuccess(res, await service.apply(getAuth(req).userId, input), 201);
    }),

    getApplicationStatus: asyncHandler(async (req, res) => {
      sendSuccess(res, await service.getApplicationStatus(getAuth(req).userId));
    }),
  };
}
