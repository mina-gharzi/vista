import type { RequestHandler } from "express";
import type {
  CreateProductInput,
  UpdateProductInput,
  UpdateProductStatusInput,
} from "@vista/shared";
import { getAuth } from "../../middlewares/requireAuth";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import type { ProductsService } from "./products.service";

export interface ProductsController {
  create: RequestHandler;
  update: RequestHandler;
  updateStatus: RequestHandler;
  getOne: RequestHandler;
  list: RequestHandler;
}

export function createProductsController(service: ProductsService): ProductsController {
  return {
    // req.body قبلاً توسط validate(createProductSchema) پاک‌سازی و Parse شده است
    create: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      const product = await service.createProduct(userId, req.body as CreateProductInput);
      sendSuccess(res, product, 201);
    }),

    update: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      const product = await service.updateProduct(
        userId,
        req.params.id as string,
        req.body as UpdateProductInput,
      );
      sendSuccess(res, product);
    }),

    updateStatus: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      const { status } = req.body as UpdateProductStatusInput;
      const product = await service.changeStatus(userId, req.params.id as string, status);
      sendSuccess(res, product);
    }),

    getOne: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      const product = await service.getMine(userId, req.params.id as string);
      sendSuccess(res, product);
    }),

    list: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      const result = await service.listMine(userId, req.query as never);
      sendSuccess(res, result);
    }),
  };
}
