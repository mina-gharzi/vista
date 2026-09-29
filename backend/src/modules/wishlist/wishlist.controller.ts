import type { RequestHandler } from "express";
import type { AddWishlistItemInput } from "@vista/shared";
import { getAuth } from "../../middlewares/requireAuth";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import type { WishlistService } from "./wishlist.service";

export interface WishlistController {
  list: RequestHandler;
  getStatus: RequestHandler;
  add: RequestHandler;
  remove: RequestHandler;
}

export function createWishlistController(service: WishlistService): WishlistController {
  return {
    list: asyncHandler(async (req, res) => {
      sendSuccess(res, await service.list(getAuth(req).userId));
    }),

    getStatus: asyncHandler(async (req, res) => {
      sendSuccess(
        res,
        await service.getStatus(getAuth(req).userId, req.params.productId as string),
      );
    }),

    add: asyncHandler(async (req, res) => {
      const { productId } = req.body as AddWishlistItemInput;
      sendSuccess(res, await service.add(getAuth(req).userId, productId), 201);
    }),

    remove: asyncHandler(async (req, res) => {
      sendSuccess(res, await service.remove(getAuth(req).userId, req.params.productId as string));
    }),
  };
}
