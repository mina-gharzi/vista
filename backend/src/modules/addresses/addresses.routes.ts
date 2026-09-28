import { Router } from "express";
import { addressIdParamSchema, addressInputSchema, updateAddressSchema } from "@vista/shared";
import { requireAuth } from "../../middlewares/requireAuth";
import { validate } from "../../middlewares/validate";
import type { AddressesController } from "./addresses.controller";

export function createAddressesRouter(controller: AddressesController): Router {
  const router = Router();

  router.use(requireAuth); // آدرس‌ها همیشه مخصوص کاربر واردشده‌اند

  router.get("/", controller.list);
  router.post("/", validate(addressInputSchema, "body"), controller.create);
  router.patch(
    "/:id",
    validate(addressIdParamSchema, "params"),
    validate(updateAddressSchema, "body"),
    controller.update,
  );
  router.delete("/:id", validate(addressIdParamSchema, "params"), controller.remove);

  return router;
}
