import type { RequestHandler } from "express";
import type {
  AdminCategoriesQuery,
  AdminOrdersQuery,
  AdminProductStatusInput,
  AdminProductsQuery,
  AdminSellerStatusInput,
  AdminSellersQuery,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@vista/shared";
import { getAuth } from "../../middlewares/requireAuth";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import type { AdminCategoriesService } from "./adminCategories.service";
import type { AdminDashboardService } from "./adminDashboard.service";
import type { AdminOrdersService } from "./adminOrders.service";
import type { AdminProductsService } from "./adminProducts.service";
import type { AdminSellersService } from "./adminSellers.service";

export interface AdminServices {
  dashboard: AdminDashboardService;
  sellers: AdminSellersService;
  products: AdminProductsService;
  categories: AdminCategoriesService;
  orders: AdminOrdersService;
}

export type AdminController = Record<
  | "dashboard"
  | "listSellers"
  | "getSeller"
  | "changeSellerStatus"
  | "listProducts"
  | "getProduct"
  | "changeProductStatus"
  | "listCategories"
  | "createCategory"
  | "updateCategory"
  | "deleteCategory"
  | "listOrders"
  | "getOrder",
  RequestHandler
>;

/**
 * کنترلرها نازک‌اند. شناسهٔ ادمین «فقط» از توکن احرازشده (getAuth) می‌آید؛ هیچ فیلد adminId/actor
 * از Body یا Query خوانده نمی‌شود.
 */
export function createAdminController(services: AdminServices): AdminController {
  const id = (req: Parameters<RequestHandler>[0]) => req.params.id as string;
  return {
    dashboard: asyncHandler(async (_req, res) => sendSuccess(res, await services.dashboard.get())),

    listSellers: asyncHandler(async (req, res) =>
      sendSuccess(res, await services.sellers.list(req.query as unknown as AdminSellersQuery)),
    ),
    getSeller: asyncHandler(async (req, res) => sendSuccess(res, await services.sellers.getDetail(id(req)))),
    changeSellerStatus: asyncHandler(async (req, res) =>
      sendSuccess(
        res,
        await services.sellers.changeStatus(getAuth(req).userId, id(req), req.body as AdminSellerStatusInput),
      ),
    ),

    listProducts: asyncHandler(async (req, res) =>
      sendSuccess(res, await services.products.list(req.query as unknown as AdminProductsQuery)),
    ),
    getProduct: asyncHandler(async (req, res) => sendSuccess(res, await services.products.getDetail(id(req)))),
    changeProductStatus: asyncHandler(async (req, res) =>
      sendSuccess(
        res,
        await services.products.changeStatus(getAuth(req).userId, id(req), req.body as AdminProductStatusInput),
      ),
    ),

    listCategories: asyncHandler(async (req, res) =>
      sendSuccess(res, await services.categories.list(req.query as unknown as AdminCategoriesQuery)),
    ),
    createCategory: asyncHandler(async (req, res) =>
      sendSuccess(res, await services.categories.create(getAuth(req).userId, req.body as CreateCategoryInput), 201),
    ),
    updateCategory: asyncHandler(async (req, res) =>
      sendSuccess(
        res,
        await services.categories.update(getAuth(req).userId, id(req), req.body as UpdateCategoryInput),
      ),
    ),
    deleteCategory: asyncHandler(async (req, res) => {
      await services.categories.remove(getAuth(req).userId, id(req));
      sendSuccess(res, null);
    }),

    listOrders: asyncHandler(async (req, res) =>
      sendSuccess(res, await services.orders.list(req.query as unknown as AdminOrdersQuery)),
    ),
    getOrder: asyncHandler(async (req, res) => sendSuccess(res, await services.orders.getDetail(id(req)))),
  };
}
