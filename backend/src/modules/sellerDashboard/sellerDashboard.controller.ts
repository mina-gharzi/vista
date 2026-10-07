import type { RequestHandler } from "express";
import { getAuth } from "../../middlewares/requireAuth";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import type { SellerDashboardService } from "./sellerDashboard.service";

export interface SellerDashboardController {
  get: RequestHandler;
}

export function createSellerDashboardController(
  service: SellerDashboardService,
): SellerDashboardController {
  return {
    // Query/Body/Params عمداً خوانده نمی‌شوند: ?sellerId=... هیچ اثری ندارد
    get: asyncHandler(async (req, res) => {
      // داده مالی فروشنده نباید در Cache مرورگر/Proxy بماند
      res.set("Cache-Control", "no-store");
      sendSuccess(res, await service.getDashboard(getAuth(req).userId));
    }),
  };
}
