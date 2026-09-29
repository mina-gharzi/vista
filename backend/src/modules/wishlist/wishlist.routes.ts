import { Router } from "express";
import { addWishlistItemSchema, wishlistProductParamSchema } from "@vista/shared";
import { requireAuth } from "../../middlewares/requireAuth";
import { validate } from "../../middlewares/validate";
import type { WishlistController } from "./wishlist.controller";

export function createWishlistRouter(controller: WishlistController): Router {
  const router = Router();
  router.use(requireAuth);

  router.get("/", controller.list);
  router.post("/", validate(addWishlistItemSchema, "body"), controller.add);
  router.get("/:productId", validate(wishlistProductParamSchema, "params"), controller.getStatus);
  router.delete("/:productId", validate(wishlistProductParamSchema, "params"), controller.remove);

  return router;
}
