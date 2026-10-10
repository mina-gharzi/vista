import type { RequestHandler } from "express";
import type {
  AdjustStockInput,
  InventoryMovementsQuery,
  RestockInput,
  SellerInventoryQuery,
} from "@vista/shared";
import { getAuth } from "../../middlewares/requireAuth";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import type { InventoryService } from "./inventory.service";

export interface InventoryController {
  guard: RequestHandler;
  list: RequestHandler;
  movements: RequestHandler;
  restock: RequestHandler;
  adjust: RequestHandler;
}

export function createInventoryController(service: InventoryService): InventoryController {
  return {
    // گارد قبل از اعتبارسنجی: غیرفروشنده حتی پیام خطای فیلدها را نمی‌بیند
    guard: (req, _res, next) => {
      service.assertCanManage(getAuth(req).userId).then(() => next(), next);
    },

    list: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      sendSuccess(res, await service.list(userId, req.query as unknown as SellerInventoryQuery));
    }),

    movements: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      sendSuccess(
        res,
        await service.movements(
          userId,
          req.params.variantId as string,
          req.query as unknown as InventoryMovementsQuery,
        ),
      );
    }),

    restock: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      sendSuccess(res, await service.restock(userId, req.params.variantId as string, req.body as RestockInput));
    }),

    adjust: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      sendSuccess(
        res,
        await service.adjust(userId, req.params.variantId as string, req.body as AdjustStockInput),
      );
    }),
  };
}
