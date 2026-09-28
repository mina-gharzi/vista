import { Router } from "express";
import { checkoutSchema, orderIdParamSchema, ordersQuerySchema } from "@vista/shared";
import { requireAuth } from "../../middlewares/requireAuth";
import { validate } from "../../middlewares/validate";
import type { OrdersController } from "./orders.controller";

export function createCheckoutRouter(controller: OrdersController): Router {
  const router = Router();
  router.use(requireAuth);
  router.post("/", validate(checkoutSchema, "body"), controller.checkout);
  return router;
}

export function createOrdersHistoryRouter(controller: OrdersController): Router {
  const router = Router();
  router.use(requireAuth);
  router.get("/", validate(ordersQuerySchema, "query"), controller.list);
  router.get("/:id", validate(orderIdParamSchema, "params"), controller.getOne);
  return router;
}
