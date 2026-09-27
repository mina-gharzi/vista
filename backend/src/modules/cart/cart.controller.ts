import type { RequestHandler } from "express";
import type { AddCartItemInput, UpdateCartItemInput } from "@vista/shared";
import { getAuth } from "../../middlewares/requireAuth";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import type { CartService } from "./cart.service";

export interface CartController {
  getCart: RequestHandler;
  addItem: RequestHandler;
  updateItem: RequestHandler;
  removeItem: RequestHandler;
}

export function createCartController(service: CartService): CartController {
  return {
    getCart: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      sendSuccess(res, await service.getCart(userId));
    }),

    // req.body قبلاً توسط validate(addCartItemSchema) Parse شده است
    addItem: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      const { variantId, quantity } = req.body as AddCartItemInput;
      sendSuccess(res, await service.addItem(userId, variantId, quantity), 201);
    }),

    updateItem: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      const { quantity } = req.body as UpdateCartItemInput;
      sendSuccess(
        res,
        await service.updateItemQuantity(userId, req.params.variantId as string, quantity),
      );
    }),

    removeItem: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      sendSuccess(res, await service.removeItem(userId, req.params.variantId as string));
    }),
  };
}
