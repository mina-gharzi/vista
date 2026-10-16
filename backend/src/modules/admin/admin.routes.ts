import { Router, type RequestHandler } from "express";
import {
  adminCategoriesQuerySchema,
  adminIdParamSchema,
  adminOrdersQuerySchema,
  adminProductStatusSchema,
  adminProductsQuerySchema,
  adminSellerStatusSchema,
  adminSellersQuerySchema,
  createCategorySchema,
  updateCategorySchema,
} from "@vista/shared";
import { validate } from "../../middlewares/validate";
import type { AdminController } from "./admin.controller";

/**
 * guard (احراز هویت + نقش ADMIN از دیتابیس) «قبل از» هر validate اجرا می‌شود: غیرادمین حتی پیام خطای
 * اعتبارسنجی هم نمی‌بیند و هیچ مسیری بدون آن ثبت نمی‌شود (router.use).
 */
export function createAdminRouter(controller: AdminController, guard: RequestHandler[]): Router {
  const router = Router();
  router.use(...guard);
  const idParam = validate(adminIdParamSchema, "params");

  router.get("/dashboard", controller.dashboard);

  router.get("/sellers", validate(adminSellersQuerySchema, "query"), controller.listSellers);
  router.get("/sellers/:id", idParam, controller.getSeller);
  router.patch("/sellers/:id/status", idParam, validate(adminSellerStatusSchema, "body"), controller.changeSellerStatus);

  router.get("/products", validate(adminProductsQuerySchema, "query"), controller.listProducts);
  router.get("/products/:id", idParam, controller.getProduct);
  router.patch("/products/:id/status", idParam, validate(adminProductStatusSchema, "body"), controller.changeProductStatus);

  router.get("/categories", validate(adminCategoriesQuerySchema, "query"), controller.listCategories);
  router.post("/categories", validate(createCategorySchema, "body"), controller.createCategory);
  router.patch("/categories/:id", idParam, validate(updateCategorySchema, "body"), controller.updateCategory);
  router.delete("/categories/:id", idParam, controller.deleteCategory);

  router.get("/orders", validate(adminOrdersQuerySchema, "query"), controller.listOrders);
  router.get("/orders/:id", idParam, controller.getOrder);

  return router;
}
