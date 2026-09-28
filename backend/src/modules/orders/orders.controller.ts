import type { RequestHandler } from "express";
import type { CheckoutInput, OrdersQuery } from "@vista/shared";
import { getAuth } from "../../middlewares/requireAuth";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import type { OrdersService } from "./orders.service";

export interface OrdersController {
  checkout: RequestHandler;
  list: RequestHandler;
  getOne: RequestHandler;
}

export function createOrdersController(service: OrdersService): OrdersController {
  return {
    checkout: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      const { addressId } = req.body as CheckoutInput;
      sendSuccess(res, await service.checkout(userId, addressId), 201);
    }),

    list: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      sendSuccess(res, await service.list(userId, req.query as unknown as OrdersQuery));
    }),

    getOne: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      sendSuccess(res, await service.getDetail(userId, req.params.id as string));
    }),
  };
}
