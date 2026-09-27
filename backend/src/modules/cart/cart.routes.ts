import { Router } from "express";
import { addCartItemSchema, cartItemParamSchema, updateCartItemSchema } from "@vista/shared";
import { requireAuth } from "../../middlewares/requireAuth";
import { validate } from "../../middlewares/validate";
import type { CartController } from "./cart.controller";

export function createCartRouter(controller: CartController): Router {
  const router = Router();

  // سبد خرید مخصوص کاربر واردشده است؛ بدون محدودیت نقش (CUSTOMER/SELLER/ADMIN همه می‌توانند بخرند)
  router.use(requireAuth);

  router.get("/", controller.getCart);
  router.post("/", validate(addCartItemSchema, "body"), controller.addItem);
  router.patch(
    "/:variantId",
    validate(cartItemParamSchema, "params"),
    validate(updateCartItemSchema, "body"),
    controller.updateItem,
  );
  router.delete("/:variantId", validate(cartItemParamSchema, "params"), controller.removeItem);

  return router;
}
