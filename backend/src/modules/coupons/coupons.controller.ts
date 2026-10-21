import type { RequestHandler } from "express";
import type { ValidateCouponInput } from "@vista/shared";
import { getAuth } from "../../middlewares/requireAuth";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import type { CouponsService } from "./coupons.service";

export interface CouponsController {
  validate: RequestHandler;
}

export function createCouponsController(service: CouponsService): CouponsController {
  return {
    // شناسهٔ کاربر فقط از توکن؛ سبد همیشه سبد سمت سرور است (نه چیزی که Client بفرستد)
    validate: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      const { code } = req.body as ValidateCouponInput;
      sendSuccess(res, await service.preview(userId, code));
    }),
  };
}
