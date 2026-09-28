import type { RequestHandler } from "express";
import type { AddressInput, UpdateAddressInput } from "@vista/shared";
import { getAuth } from "../../middlewares/requireAuth";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import type { AddressesService } from "./addresses.service";

export interface AddressesController {
  list: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
}

export function createAddressesController(service: AddressesService): AddressesController {
  return {
    list: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      sendSuccess(res, await service.list(userId));
    }),

    create: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      sendSuccess(res, await service.create(userId, req.body as AddressInput), 201);
    }),

    update: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      const address = await service.update(
        userId,
        req.params.id as string,
        req.body as UpdateAddressInput,
      );
      sendSuccess(res, address);
    }),

    remove: asyncHandler(async (req, res) => {
      const { userId } = getAuth(req);
      await service.remove(userId, req.params.id as string);
      sendSuccess(res, null);
    }),
  };
}
