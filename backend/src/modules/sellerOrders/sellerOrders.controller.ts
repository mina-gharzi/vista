import type { RequestHandler } from "express";
import type { SellerOrdersQuery, UpdateSellerOrderStatusInput } from "@vista/shared";
import { getAuth } from "../../middlewares/requireAuth";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import type { SellerOrdersService } from "./sellerOrders.service";

export interface SellerOrdersController {
  guard: RequestHandler;
  list: RequestHandler;
  overview: RequestHandler;
  detail: RequestHandler;
  updateStatus: RequestHandler;
}

export function createSellerOrdersController(service: SellerOrdersService): SellerOrdersController {
  return {
    // گارد قبل از اعتبارسنجی: غیرفروشنده حتی پیام خطای فیلدها را نمی‌بیند
    guard: (req, _res, next) => {
      service.assertCanManage(getAuth(req).userId).then(() => next(), next);
    },

    list: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      sendSuccess(res, await service.list(userId, req.query as unknown as SellerOrdersQuery));
    }),

    overview: asyncHandler(async (req, res) => {
      sendSuccess(res, await service.overview(getAuth(req).userId));
    }),

    detail: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      sendSuccess(res, await service.detail(userId, req.params.sellerOrderId as string));
    }),

    updateStatus: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      sendSuccess(
        res,
        await service.updateStatus(
          userId,
          req.params.sellerOrderId as string,
          req.body as UpdateSellerOrderStatusInput,
        ),
      );
    }),
  };
}
