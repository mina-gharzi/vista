import type { RequestHandler } from "express";
import type {
  AdminCouponsQuery,
  CouponStatusInput,
  CreateCouponInput,
  UpdateCouponInput,
} from "@vista/shared";
import { getAuth } from "../../middlewares/requireAuth";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import type { AdminCouponsService } from "./adminCoupons.service";

export type AdminCouponsController = Record<"list" | "getOne" | "create" | "update" | "setStatus", RequestHandler>;

/** هویت ادمین فقط از توکن احرازشده می‌آید؛ هیچ actor/adminId از Body یا Query خوانده نمی‌شود. */
export function createAdminCouponsController(service: AdminCouponsService): AdminCouponsController {
  const couponId = (req: Parameters<RequestHandler>[0]) => req.params.couponId as string;
  return {
    list: asyncHandler(async (req, res) =>
      sendSuccess(res, await service.list(req.query as unknown as AdminCouponsQuery)),
    ),
    getOne: asyncHandler(async (req, res) => sendSuccess(res, await service.getDetail(couponId(req)))),
    create: asyncHandler(async (req, res) =>
      sendSuccess(res, await service.create(getAuth(req).userId, req.body as CreateCouponInput), 201),
    ),
    update: asyncHandler(async (req, res) =>
      sendSuccess(res, await service.update(getAuth(req).userId, couponId(req), req.body as UpdateCouponInput)),
    ),
    setStatus: asyncHandler(async (req, res) =>
      sendSuccess(
        res,
        await service.setStatus(getAuth(req).userId, couponId(req), req.body as CouponStatusInput),
      ),
    ),
  };
}
